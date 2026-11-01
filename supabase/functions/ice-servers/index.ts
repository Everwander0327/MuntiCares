// Mints short-lived ICE servers for the WebRTC teleconsultation calls.
//
// Precedence: TURN REST HMAC (coturn `use-auth-secret`, Metered "REST API credentials")
// -> vendor credentials endpoint (Twilio/Metered/Xirsys response shapes) -> static server-side
// TURN -> STUN only. Returns STUN only when nothing is configured so calls keep working in
// environments where TURN has not been provisioned yet.
//
// Secrets stay in Edge Function env; only the derived, expiring credential reaches the client.
import { createClient } from "npm:@supabase/supabase-js@2";

type IceServer = {
  urls: string[];
  username?: string;
  credential?: string;
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ??
  Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? "";

const STUN_SERVERS: IceServer[] = [
  { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
  { urls: ["stun:stun.cloudflare.com:3478"] },
];

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "content-type": "application/json",
      ...init.headers,
    },
  });

const withCors = (req: Request, res: Response) => {
  const origin = req.headers.get("origin");
  if (origin) res.headers.set("access-control-allow-origin", origin);
  res.headers.set("vary", "origin");
  res.headers.set("access-control-allow-headers", "authorization, apikey, content-type");
  res.headers.set("access-control-allow-methods", "GET, OPTIONS");
  res.headers.set("access-control-max-age", "600");
  return res;
};

// A callable that lets any anonymous visitor mint TURN relays is a metered-bill
// open proxy, so an authenticated Supabase user is required.
const authenticate = async (req: Request): Promise<boolean> => {
  const jwt = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!jwt || !SUPABASE_URL || !SUPABASE_ANON_KEY) return false;
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.getUser();
  return !error && !!data?.user;
};

const splitUrls = (value: string): string[] =>
  value.split(",").map((url) => url.trim()).filter(Boolean);

// RFC 5389 / coturn `use-auth-secret` style: username is "<expiry-epoch>:<id>",
// credential is base64(HMAC-SHA1(sharedSecret, username)).
const restHmacCredentials = async (): Promise<{ turn: IceServer[]; ttl: number } | null> => {
  const secret = Deno.env.get("TURN_REST_SECRET");
  const urls = Deno.env.get("TURN_URLS");
  if (!secret || !urls) return null;

  const ttl = Number(Deno.env.get("TURN_TTL_SECONDS") ?? 7200);
  const expiry = Math.floor(Date.now() / 1000) + (Number.isFinite(ttl) ? ttl : 7200);
  const username = `${expiry}:${crypto.randomUUID()}`;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(username));
  const credential = btoa(String.fromCharCode(...new Uint8Array(signature)));

  return { turn: [{ urls: splitUrls(urls), username, credential }], ttl };
};

// Proxy for vendors that mint the credentials themselves.
const vendorCredentials = async (): Promise<{ turn: IceServer[]; ttl: number } | null> => {
  const endpoint = Deno.env.get("TURN_CREDENTIALS_URL");
  if (!endpoint) return null;

  const headers: Record<string, string> = { accept: "application/json" };
  const auth = Deno.env.get("TURN_CREDENTIALS_AUTH"); // e.g. "Basic ...", "Bearer ...", "TMS <key>"
  if (auth) headers.authorization = auth;

  const res = await fetch(endpoint, { headers });
  if (!res.ok) {
    console.error(`[ice-servers] vendor endpoint returned ${res.status}`);
    return null;
  }

  const body = await res.json().catch(() => null);
  const raw = body?.iceServers ?? body?.ice_servers;
  if (!Array.isArray(raw)) {
    console.error("[ice-servers] vendor response had no iceServers array");
    return null;
  }

  const turn = raw
    .map((entry: { urls?: string | string[]; url?: string; username?: string; credential?: string }) => {
      const candidate = entry.urls ?? entry.url;
      const urls = Array.isArray(candidate) ? candidate : candidate ? [candidate] : [];
      return { urls: urls.filter((u) => u.startsWith("turn")), username: entry.username, credential: entry.credential };
    })
    .filter((entry: IceServer) => entry.urls.length > 0);

  const ttl = Number(body?.ttl ?? 3600);
  return turn.length > 0 ? { turn, ttl: Number.isFinite(ttl) ? ttl : 3600 } : null;
};

const staticCredentials = (): { turn: IceServer[]; ttl: number } | null => {
  const urls = Deno.env.get("TURN_URLS");
  const username = Deno.env.get("TURN_USERNAME");
  const credential = Deno.env.get("TURN_PASSWORD");
  if (!urls || !username || !credential) return null;
  return { turn: [{ urls: splitUrls(urls), username, credential }], ttl: 3600 };
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return withCors(req, new Response(null, { status: 204 }));
  if (req.method !== "GET") return withCors(req, json({ error: "method_not_allowed" }, { status: 405 }));

  if (!(await authenticate(req))) {
    return withCors(req, json({ error: "unauthorized" }, { status: 401 }));
  }

  let resolved: { turn: IceServer[]; ttl: number } | null = null;
  try {
    resolved = await restHmacCredentials();
    if (!resolved) resolved = await vendorCredentials();
  } catch (err) {
    console.error("[ice-servers] credential minting failed, falling back:", err);
  }
  if (!resolved) resolved = staticCredentials();

  const body = {
    iceServers: [...STUN_SERVERS, ...(resolved?.turn ?? [])],
    ttl: resolved?.ttl ?? 300,
    hasTurn: Boolean(resolved),
  };

  // Cache per-user and for at most a third of the credential lifetime.
  const maxAge = Math.max(60, Math.floor(body.ttl / 3));
  return withCors(
    req,
    json(body, { headers: { "cache-control": `private, max-age=${maxAge}` } }),
  );
});
