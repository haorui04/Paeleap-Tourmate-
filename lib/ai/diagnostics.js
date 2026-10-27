// Safe, bounded diagnostics for authenticated chat responses. Never pass raw
// upstream response text, prompts, exception messages, keys or URLs to users.
export function aiFailureCode(error) {
  const message = typeof error?.message === "string" ? error.message : "";
  const match = /^AI provider returned HTTP (400|401|402|403|404|408|409|422|429|500|502|503|504)$/.exec(message);
  if (match) return "UPSTREAM_HTTP_" + match[1];
  if (/not configured/.test(message)) return "PROVIDER_CONFIG_MISSING";
  if (error?.name === "TimeoutError" || error?.name === "AbortError") return "UPSTREAM_TIMEOUT";
  if (/Empty or invalid AI provider response/.test(message)) return "INVALID_PROVIDER_RESPONSE";
  if (/^(?:Invalid generated answer(?: evidence)?|Unsafe generated answer|Unsupported numeric claim)$/.test(message)) return "INVALID_GENERATED_ANSWER";
  return "UPSTREAM_NETWORK_ERROR";
}
