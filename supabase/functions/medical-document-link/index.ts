import { createClient } from "npm:@supabase/supabase-js@2.106.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info, x-supabase-api-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function respond(status: number, body: object) {
  return Response.json(body, {
    status,
    headers: { ...corsHeaders, "Cache-Control": "no-store" },
  });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (request.method !== "POST") return respond(405, { error: "Method not allowed" });

  const token = request.headers.get("Authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (!token) return respond(401, { error: "Authentication required" });

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return respond(503, { error: "Document service unavailable" });

  const service = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: identity, error: authError } = await service.auth.getUser(token);
  if (authError || !identity.user) return respond(401, { error: "Authentication required" });

  const body = await request.json().catch(() => null);
  const patientId = body?.patientId;
  const filePath = body?.filePath;
  if (typeof patientId !== "string" || !uuid.test(patientId) ||
    typeof filePath !== "string" || filePath.length > 1024 || filePath.includes("\\") ||
    filePath.split("/").some((segment) => !segment || segment === "." || segment === "..")) {
    return respond(400, { error: "Invalid document details" });
  }

  const { data: eventId, error: auditError } = await service.rpc("record_document_link_issue", {
    p_actor_id: identity.user.id,
    p_patient_id: patientId,
    p_file_path: filePath,
  });
  if (auditError?.code === "42501") return respond(403, { error: "Document access denied" });
  if (auditError || !eventId) return respond(503, { error: "Document audit unavailable" });

  const { data, error } = await service.storage
    .from("medical_documents").createSignedUrl(filePath, 3600);
  if (error || !data?.signedUrl) return respond(503, { error: "Document link unavailable" });

  return respond(200, { signedUrl: data.signedUrl });
});
