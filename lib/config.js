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
  if (groqTextEndpoint(env)) return hasConfiguredValue(env.AI_API_KEY) ? env.AI_API_KEY.trim() : null;
  return hasConfiguredValue(env.SUB2API_API_KEY) ? env.SUB2API_API_KEY
    : hasConfiguredValue(env.AI_API_KEY) ? env.AI_API_KEY : null;
}
