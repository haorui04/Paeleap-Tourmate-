import { hasConfiguredValue, localDemoEnabled, mockAiEnabled } from "../../../lib/config.js";

export const runtime = "nodejs";

export async function GET() {
  const localDemo = localDemoEnabled();
  return Response.json({
    service: "paeleap-tourism-ai",
    status: "ok",
    aiConfigured: [process.env.AI_BASE_URL, process.env.AI_API_KEY, process.env.AI_MODEL].every(hasConfiguredValue),
    supabaseConfigured: [process.env.SUPABASE_URL, process.env.SUPABASE_PUBLISHABLE_KEY, process.env.SUPABASE_SERVICE_ROLE_KEY].every(hasConfiguredValue),
    localDemoMode: localDemo,
    aiMockMode: mockAiEnabled()
  }, { headers: { "Cache-Control": "no-store" } });
}
