// Fans an outgoing consultation call out to the callee's registered devices.
//
// Supabase Realtime is a websocket, so it can only ring an app that is already running.
// This function is the wake-up path: the caller invokes it right after writing the
// `calls` row, and every device token the callee owns gets one FCM message.
//
// The message carries a `notification` block, not data alone: a data-only message is
// held back while the app process is stopped, which is exactly the state a missed call
// arrives in. `channel_id` must match the channel the app creates on Android 8+, and
// the 30-second TTL is deliberate — an invite delivered ten minutes later is noise.
//
// Env: FIREBASE_PROJECT_ID, FIREBASE_SERVICE_ACCOUNT_JSON, SUPABASE_SERVICE_ROLE_KEY.
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ??
  Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const PROJECT_ID = Deno.env.get("FIREBASE_PROJECT_ID") ?? "";
const CALL_CHANNEL_ID = "munticares-calls";

type CallRow = {
  id: string;
  caller_id: string;
  callee_id: string;
  call_type: string;
  status: string;
};

let cachedToken: { value: string; expiresAt: number } | null = null;

const encode = (value: string) => new TextEncoder().encode(value);

const base64Url = (bytes: ArrayBuffer | Uint8Array) => {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  view.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

const privateKeyToPkcs8 = (pem: string): Uint8Array => {
  const body = pem.replace(/-----(BEGIN|END) PRIVATE KEY-----/g, "").replace(/\s+/g, "");
  const binary = atob(body);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
};

// OAuth2 client-keys flow: a signed JWT assertion exchanged for a short-lived
// access token, cached until Google hands back a nearer expiry.
const getAccessToken = async (): Promise<string> => {
  if (cachedToken && Date.now() < cachedToken.expiresAt) return cachedToken.value;

  const account = JSON.parse(Deno.env.get("FIREBASE_SERVICE_ACCOUNT_JSON") ?? "{}");
  if (!account.client_email || !account.private_key) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is missing client_email or private_key");
  }

  const issuedAt = Math.floor(Date.now() / 1000);
  const header = base64Url(encode(JSON.stringify({ alg: "RS256", typ: "JWT" })));
  const claims = base64Url(encode(JSON.stringify({
    iss: account.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: account.token_uri || "https://oauth2.googleapis.com/token",
    exp: issuedAt + 3600,
    iat: issuedAt,
  })));
  const signingInput = `${header}.${claims}`;

  const key = await crypto.subtle.importKey(
    "pkcs8",
    privateKeyToPkcs8(account.private_key) as unknown as ArrayBuffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, encode(signingInput));

  const response = await fetch(account.token_uri || "https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${signingInput}.${base64Url(signature)}`,
    }),
  });
  if (!response.ok) {
    throw new Error(`OAuth token exchange failed with ${response.status}: ${await response.text()}`);
  }
  const payload = await response.json();
  cachedToken = {
    value: payload.access_token as string,
    expiresAt: Date.now() + (Number(payload.expires_in) || 3600) * 1000 - 60000,
  };
  return cachedToken.value;
};

const sendTo = async (accessToken: string, registrationToken: string, call: CallRow) => {
  const isVideo = call.call_type !== "audio";
  const response = await fetch(`https://fcm.googleapis.com/v1/projects/${PROJECT_ID}/messages:send`, {
    method: "POST",
    headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
    body: JSON.stringify({
      message: {
        token: registrationToken,
        data: {
          kind: "call_invite",
          call_id: call.id,
          sender_id: call.caller_id,
          call_type: call.call_type,
        },
        android: {
          priority: "high",
          ttl: "30s",
          notification: {
            title: isVideo ? "Incoming video consultation" : "Incoming voice consultation",
            body: "Tap to answer while the call is still ringing.",
            channel_id: CALL_CHANNEL_ID,
          },
        },
      },
    }),
  });
  return response;
};

const withCors = (req: Request, res: Response) => {
  const origin = req.headers.get("origin");
  if (origin) res.headers.set("access-control-allow-origin", origin);
  res.headers.set("vary", "origin");
  res.headers.set(
    "access-control-allow-headers",
    req.headers.get("access-control-request-headers") ??
      "authorization, apikey, content-type, x-client-info, x-supabase-api-version, prefer",
  );
  res.headers.set("access-control-allow-methods", "POST, OPTIONS");
  res.headers.set("access-control-max-age", "600");
  return res;
};

const json = (req: Request, body: unknown, init: ResponseInit = {}) =>
  withCors(
    req,
    new Response(JSON.stringify(body), {
      ...init,
      headers: {
        "content-type": "application/json",
        ...init.headers,
      },
    }),
  );

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return withCors(req, new Response(null, { status: 204 }));
  }
  if (req.method !== "POST") {
    return json(req, { error: "method_not_allowed" }, { status: 405 });
  }

  const authHeader = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ?? "";
  const jwtClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${authHeader}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authError } = await jwtClient.auth.getUser();
  if (authError || !authData?.user) {
    return json(req, { error: "unauthorized" }, { status: 401 });
  }

  const { callId } = await req.json().catch(() => ({ callId: null }));
  if (!callId || !SERVICE_ROLE_KEY || !PROJECT_ID) {
    return json(req, { error: "bad_request" }, { status: 400 });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Read the record rather than trusting the request body, so a caller cannot push
  // an invite onto a call they are not on, or under a fabricated type.
  const { data: call, error: callError } = await admin
    .from("calls")
    .select("id, caller_id, callee_id, call_type, status")
    .eq("id", callId)
    .maybeSingle<CallRow>();

  if (callError || !call) {
    return json(req, { error: "call_not_found" }, { status: 404 });
  }
  if (call.caller_id !== authData.user.id || call.status !== "ringing") {
    return json(req, { error: "not_ringable" }, { status: 403 });
  }

  const { data: tokens, error: tokensError } = await admin
    .from("push_tokens")
    .select("device_token")
    .eq("user_id", call.callee_id)
    .eq("platform", "android");

  if (tokensError || !tokens?.length) {
    return json(req, { delivered: 0, reason: "no_tokens" });
  }

  let accessToken: string;
  try {
    accessToken = await getAccessToken();
  } catch (err) {
    console.error("[call-invite] OAuth failed:", err);
    return json(req, { error: "push_provider_unavailable" }, { status: 502 });
  }

  let delivered = 0;
  for (const { device_token: registrationToken } of tokens) {
    try {
      const response = await sendTo(accessToken, registrationToken, call);
      delivered += 1;
      if (response.status === 404 || response.status === 400) {
        // Unregistered or malformed: the app is gone from this handset, so stop
        // spending fan-out budget on it.
        await admin.from("push_tokens").delete().eq("device_token", registrationToken);
        delivered -= 1;
      } else if (!response.ok) {
        console.warn(`[call-invite] FCM ${response.status} for one device`);
      }
    } catch (err) {
      console.warn("[call-invite] send failed for one device:", err);
    }
  }

  return json(req, { delivered, attempted: tokens.length });
});
