// Server-side configuration helpers. Public status responses expose booleans only.
export function hasConfiguredValue(value) {
  return typeof value === "string" && Boolean(value.trim()) &&
    !/replace_me|your-project|your-provider|your_actual|your_supported|replace_with/i.test(value);
}

export function localDemoEnabled() {
  return process.env.NODE_ENV !== "production" && process.env.ALLOW_LOCAL_DEMO === "true";
}

export function mockAiEnabled() {
  return process.env.NODE_ENV !== "production" && process.env.AI_MOCK_MODE === "true";
}

const GROQ_BASE_URL = "https://api.groq.com/openai/v1";
export const GEMINI_IMAGE_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai";
export const GEMINI_FLASH_MODEL = "gemini-3.8-flash";
export const GEMINI_FLASH_LITE_MODEL = "gemini-3.1-flash-lite";
export const GEMINI_FLASH_MODELS = new Set([GEMINI_FLASH_MODEL, GEMINI_FLASH_LITE_MODEL, "gemini-3.6-flash", "gemini-3.5-flash-lite"]);

export function geminiTextEndpoint(env = process.env) {
  return [GEMINI_IMAGE_BASE_URL, GEMINI_IMAGE_BASE_URL + "/", GEMINI_IMAGE_BASE_URL + "/chat/completions"].includes(env.AI_BASE_URL?.trim());
}

export function groqTextEndpoint(env = process.env) {
  return [GROQ_BASE_URL, GROQ_BASE_URL + "/", GROQ_BASE_URL + "/chat/completions"].includes(env.AI_BASE_URL?.trim());
}

export function useGroqVision(env = process.env) {
  return groqTextEndpoint(env) || env.AI_IMAGE_IDENTIFICATION_PROVIDER === "groq" || hasConfiguredValue(env.GROQ_VISION_API_KEY);
}

export function groqVisionConfig(env = process.env) {
  if (!hasConfiguredValue(env.GROQ_VISION_API_KEY)) return null;
  return {
    baseUrl: GROQ_BASE_URL,
    key: env.GROQ_VISION_API_KEY.trim(),
    model: "qwen/qwen3.8-27b",
    protocol: "chat_completions",
    responseFormat: { type: "json_object" }
  };
}

// Sub2API's Codex setup uses SUB2API_API_KEY, while older chatbot deployments
// use AI_API_KEY. Prefer the dedicated key when both are set. Neither is public.
export function resolveAiApiKey(env = process.env) {
  if (groqTextEndpoint(env) || geminiTextEndpoint(env)) return hasConfiguredValue(env.AI_API_KEY) ? env.AI_API_KEY.trim() : null;
  return hasConfiguredValue(env.SUB2API_API_KEY) ? env.SUB2API_API_KEY
    : hasConfiguredValue(env.AI_API_KEY) ? env.AI_API_KEY : null;
}
