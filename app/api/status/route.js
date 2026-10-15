export const runtime = "nodejs";

export async function GET() {
  const localDemo = process.env.NODE_ENV !== "production" && process.env.ALLOW_LOCAL_DEMO === "true";
  return Response.json({
    service: "paeleap-tourism-ai",
    status: "ok",
    aiConfigured: Boolean(process.env.AI_BASE_URL && process.env.AI_API_KEY && process.env.AI_MODEL),
    supabaseConfigured: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_PUBLISHABLE_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY),
    localDemoMode: localDemo
  }, { headers: { "Cache-Control": "no-store" } });
}
