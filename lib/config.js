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
