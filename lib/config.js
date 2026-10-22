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


// Sub2API's Codex setup uses SUB2API_API_KEY, while older chatbot deployments
// use AI_API_KEY. Prefer the dedicated key when both are set. Neither is public.
export function resolveAiApiKey(env = process.env) {
  return hasConfiguredValue(env.SUB2API_API_KEY) ? env.SUB2API_API_KEY
    : hasConfiguredValue(env.AI_API_KEY) ? env.AI_API_KEY : null;
}
