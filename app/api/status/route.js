import { hasConfiguredValue, localDemoEnabled, mockAiEnabled, resolveAiApiKey } from "../../../lib/config.js";

export const runtime = "nodejs";

export async function GET() {
  const localDemo = localDemoEnabled();
  // Expose active mode without revealing provider credentials.
  // This confirms configuration, NOT that a live provider inference succeeds.
  const aiResponseMode = process.env.AI_RESPONSE_MODE === "grounded" && !localDemo ? "grounded" : "faq";
  const ready = [process.env.AI_BASE_URL, resolveAiApiKey(), process.env.AI_MODEL,
    process.env.SUPABASE_URL, process.env.SUPABASE_PUBLISHABLE_KEY, process.env.SUPABASE_SERVICE_ROLE_KEY,
    process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY].every(hasConfiguredValue) &&
    (process.env.FAQ_BANK_SOURCE || "supabase") === "supabase";
  return Response.json({
    service: "paeleap-tourism-ai",
    status: process.env.NODE_ENV === "production" && !ready ? "unconfigured" : "ok",
    aiConfigured: [process.env.AI_BASE_URL, resolveAiApiKey(), process.env.AI_MODEL].every(hasConfiguredValue),
    supabaseConfigured: [process.env.SUPABASE_URL, process.env.SUPABASE_PUBLISHABLE_KEY, process.env.SUPABASE_SERVICE_ROLE_KEY].every(hasConfiguredValue),
    localDemoMode: localDemo,
    aiMockMode: mockAiEnabled(),
    aiResponseMode,
    aiApiStyle: ["responses", "chat_completions", "anthropic"].includes(process.env.AI_API_STYLE) ? process.env.AI_API_STYLE : process.env.AI_API_STYLE ? "invalid" : "responses",
    // Configuration only, not a database/provider health check.
    faqBank: { source: process.env.FAQ_BANK_SOURCE || (process.env.NODE_ENV === "production" ? "supabase" : "local"), expectedCount: 100,
      matchingMode: mockAiEnabled() ? "offline" : "ai" }
  }, { status: process.env.NODE_ENV === "production" && !ready ? 503 : 200, headers: { "Cache-Control": "no-store" } });
}
