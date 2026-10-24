import { FAQ_MATCH_SYSTEM_PROMPT } from "./prompts.js";
import { hasConfiguredValue, mockAiEnabled, resolveAiApiKey } from "../config.js";
import { matchFaqOffline, shortlistFaqs } from "../tourism/faq-matching.js";
import { classifyInput, isPersonaOverrideResponse } from "./safety.js";
import { redactSensitiveText } from "./input-normalization.js";

// A token cap is not a byte/allocation cap. Bound the gateway's envelope too,
// including errors, rather than allocating response.json() on an unlimited body.
async function providerText(response, limit = 131072) {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let bytes = 0;
  let result = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > limit) throw new Error("Empty or invalid AI provider response: oversized");
      result += decoder.decode(value, { stream: true });
    }
    return result + decoder.decode();
  } catch {
    try { await reader.cancel(); } catch { /* best effort */ }
    throw new Error("Empty or invalid AI provider response");
  } finally { reader.releaseLock(); }
}

export function sanitizeFaqHistory(history) {
  if (!Array.isArray(history)) return [];
  return history.slice(-12).filter((turn) => turn && ["user", "assistant"].includes(turn.role) &&
    typeof turn.content === "string" && turn.content.length <= 6000 &&
    // Unsafe historic user instructions are not needed to resolve references.
    classifyInput(turn.content.slice(0, 1500)).status === "allowed" &&
    !(turn.role === "assistant" && isPersonaOverrideResponse(turn.content)))
    .map(({ role, content }) => ({ role, content: redactSensitiveText(content) }));
}

export function buildMessages({ message, language, history = [], faqs = [] }) {
  const reference = faqs.map(({ id, category, question_en, question_zh, answer_en, aliases }) => ({ id, category, question_en, question_zh, answer: answer_en, aliases }));
  const system = FAQ_MATCH_SYSTEM_PROMPT + "\nResponse language: " + (language === "zh" ? "zh" : "en") + "\nFAQ REFERENCE DATA:\n" + JSON.stringify(reference);
  const safeHistory = sanitizeFaqHistory(history).map(({ role, content }) => ({
    role: "user", content: JSON.stringify({ type: "untrusted_historical_turn", originalSpeaker: role, content })
  }));
  return [{ role: "system", content: system }, ...safeHistory, { role: "user", content: redactSensitiveText(message) }];
}

export function chatEndpoint(baseUrl) {
  const url = new URL(baseUrl);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))) throw new Error("AI_BASE_URL must be HTTPS, or HTTP on localhost");
  if (url.username || url.password || url.hash) throw new Error("AI_BASE_URL must not contain credentials or fragments");
  // The configured provider URL is the actual POST destination. Do not append /chat/completions.
  url.pathname = url.pathname.replace(/\/+$/, "") || "/";
  url.search = "";
  return url.toString();
}

export function parseFaqSelection(content, faqs) {
  if (typeof content !== "string" || content.length > 500) return null;
  // Strict two-property grammar also rejects duplicate/escaped keys. JSON.parse
  // alone silently accepts duplicate keys, creating parser-differential risk.
  const id = '"faqId"\\s*:\\s*"CN[0-9]{3}"';
  const number = '"confidence"\\s*:\\s*(?:0|1)(?:\\.[0-9]+)?(?:[eE][+-]?[0-9]+)?';
  if (!new RegExp('^\\s*\\{\\s*(?:' + id + '\\s*,\\s*' + number + '|' + number + '\\s*,\\s*' + id + ')\\s*\\}\\s*$').test(content)) return null;
  let value;
  try { value = JSON.parse(content); } catch { return null; }
  if (!value || Array.isArray(value) || Object.keys(value).some((key) => !["faqId", "confidence"].includes(key))) return null;
  if (typeof value.confidence !== "number" || !Number.isFinite(value.confidence) || value.confidence < 0.85 || value.confidence > 1) return null;
  if (!faqs.some((faq) => faq.id === value.faqId)) return null;
  return { faqId: value.faqId, confidence: value.confidence };
}


export function faqRequestPayload({ model, messages, mode = "deepseek" }) {
  const common = { model, messages, stream: false };
  if (mode === "deepseek") return { ...common, temperature: 0, max_tokens: 384,
    thinking: { type: "disabled" }, response_format: { type: "json_object" } };
  if (mode === "json") return { ...common, temperature: 0, max_tokens: 384, response_format: { type: "json_object" } };
  if (mode === "thinking") return { ...common, temperature: 0, max_tokens: 384, thinking: { type: "disabled" } };
  return { ...common, temperature: 0, max_tokens: 2048 };
}

function unsupportedParameter(errorText) {
  if (!/(unknown|unsupported|unrecognized|invalid|not supported|extra field|extra_forbidden)/i.test(errorText)) return null;
  const thinking = /(?:thinking|reasoning_effort)/i.test(errorText);
  const json = /(?:response_format|json_object)/i.test(errorText);
  return thinking && json ? "both" : thinking ? "thinking" : json ? "json" : null;
}

// Miaoqu's DeepSeek V4 defaults to reasoning mode. Disable it for short JSON
// selection. Retry only explicit 400/422 parameter-compatibility rejections;
// never retry authentication, throttling or other failures.

export function extractAssistantText(payload) {
  if (!payload || typeof payload !== "object") return null;
  if (payload.error || payload.status === "failed" || payload.status === "incomplete") return null;
  // A valid-looking alternate field must never override an explicit refusal.
  for (const root of [payload, payload.data, payload.response]) {
    if (root?.error || ["failed", "incomplete"].includes(root?.status)) return null;
    if (Array.isArray(root?.choices) && root.choices.length > 1) return null;
    const choice = root?.choices?.[0];
    if (choice?.finish_reason === "length") throw new Error("Empty or invalid AI provider response: length");
    if (["content_filter", "tool_calls", "function_call"].includes(choice?.finish_reason) ||
        choice?.message?.refusal || choice?.message?.tool_calls || choice?.message?.function_call) return null;
    if (Array.isArray(root?.output) && root.output.some((item) => item?.type === "refusal" ||
      !["message", "reasoning"].includes(item?.type) || item?.status === "incomplete" ||
      Array.isArray(item?.content) && item.content.some((part) => part?.type === "refusal"))) return null;
  }
  const unwrapContent = (content) => {
    if (typeof content === "string" && content.trim()) return content;
    if (Array.isArray(content)) {
      const value = content.filter((x) => x && (x.type === "text" || x.type === "output_text") && typeof x.text === "string")
        .map((x) => x.text).join("");
      if (value.trim()) return value;
    }
    if (content && !Array.isArray(content) && typeof content === "object" &&
        Object.keys(content).every((k) => ["faqId", "confidence"].includes(k))) return JSON.stringify(content);
    return null;
  };
  for (const root of [payload, payload.data, payload.response]) {
    if (!root || typeof root !== "object") continue;
    if (root.error) return null;
    const choice = root.choices?.[0];
    if (choice?.finish_reason === "length") throw new Error("Empty or invalid AI provider response: length");
    if (choice?.finish_reason === "content_filter" || choice?.message?.refusal) return null;
    if (choice && (["tool_calls", "function_call"].includes(choice.finish_reason) ||
        choice.message?.tool_calls || choice.message?.function_call)) return null;
    if (choice && !["tool_calls", "function_call"].includes(choice.finish_reason) &&
        !choice.message?.tool_calls && !choice.message?.function_call) {
      const content = unwrapContent(choice.message?.content ?? choice.text);
      if (content) return content;
    }
    if (root.status === "incomplete" || root.status === "failed") throw new Error("Empty or invalid AI provider response: incomplete");
    const direct = unwrapContent(root.output_text);
    if (direct) return direct;
    if (Array.isArray(root.output)) {
      for (const item of root.output) {
        if (item?.type !== "message" || item.role !== "assistant") continue;
        if (item.status === "incomplete" || item.content?.some?.((part) => part?.type === "refusal")) return null;
        const content = unwrapContent(item.content);
        if (content) return content;
      }
    }
  }
  return null;
}

function reportInvalidPayload(response, data, reason) {
  // Diagnostics intentionally expose only content type and structural booleans.
  // Never log raw provider responses, prompts, credentials, or user messages.
  const root = data && typeof data === "object" ? data : {};
  const mime = (response.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  const contentType = ["application/json", "text/plain", "text/html"].includes(mime) ? mime : "other";
  console.warn("AI provider unexpected response shape", {
    reason,
    httpStatus: response.status,
    contentType,
    hasChoices: Array.isArray(root.choices),
    hasDataChoices: Array.isArray(root.data?.choices),
    hasOutput: Array.isArray(root.output),
    hasText: typeof root.output_text === "string",
    hasErrorObject: !!root.error,
    firstChoiceContentType: typeof root.choices?.[0]?.message?.content
  });
}

export async function requestFaqSelection({ url, key, model, messages, fetchImpl = fetch }) {
  let mode = "deepseek";
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetchImpl(url, {
      method: "POST",
      headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
      body: JSON.stringify(faqRequestPayload({ model, messages, mode })),
      signal: AbortSignal.timeout(25000), cache: "no-store", redirect: "error"
    });
    if (response.ok) {
      let data;
      try { data = JSON.parse(await providerText(response)); }
      catch {
        reportInvalidPayload(response, null, "non_json");
        throw new Error("Empty or invalid AI provider response");
      }
      const content = extractAssistantText(data);
      if (!content) {
        reportInvalidPayload(response, data, "missing_assistant_text");
        throw new Error("Empty or invalid AI provider response");
      }
      return content;
    }
    if ((response.status === 400 || response.status === 422) && attempt < 2) {
      const errorText = (await providerText(response)).slice(0, 1500);
      const unsupported = unsupportedParameter(errorText);
      if (unsupported && mode !== "plain") {
        if (mode === "deepseek") mode = unsupported === "thinking" ? "json" : unsupported === "json" ? "thinking" : "plain";
        else mode = "plain";
        continue;
      }
    }
    throw new Error("AI provider returned HTTP " + response.status);
  }
  throw new Error("AI provider returned incompatible response");
}


/**
 * Codex Sub2API uses wire_api="responses"; base_url ending in /v1 is not
 * the request target. The actual inference endpoint is /v1/responses.
 */
export function responsesEndpoint(baseUrl) {
  const url = new URL(chatEndpoint(baseUrl));
  const path = url.pathname;
  url.pathname = path.endsWith("/chat/completions")
    ? path.slice(0, -"/chat/completions".length) + "/responses"
    : path.endsWith("/responses") ? path : path + "/responses";
  return url.toString();
}

export function responsesFaqPayload({ model, messages, mode = "full", outputTokenLimit = null }) {
  // Minimal mode uses only the fields required by the Responses API.
  // Some gateways reject optional OpenAI compatibility fields such as
  // reasoning, text.format or store. DeepSeek's Responses endpoint is stateless.
  const payload = mode === "minimal" ? { model, input: messages, stream: false }
    : { model, input: messages, stream: false, store: false };
  // Use only documented Responses API fields; no messages, thinking, or
  // response_format keys from Chat Completions.
  if (mode === "full" || mode === "reasoning") payload.reasoning = { effort: "none" };
  if (mode === "full" || mode === "json") payload.text = { format: { type: "json_object" } };
  if (outputTokenLimit != null) {
    if (!Number.isInteger(outputTokenLimit) || outputTokenLimit < 128 || outputTokenLimit > 2048) throw new Error("Invalid output token limit");
    payload.max_output_tokens = outputTokenLimit;
    payload.store = false;
  }
  return payload;
}

function unsupportedResponsesParameter(errorText) {
  if (!/(unknown|unsupported|unrecognized|invalid|not supported|extra field|extra_forbidden)/i.test(errorText)) return null;
  const reasoning = /(?:reasoning|effort)/i.test(errorText);
  const jsonFormat = /(?:text\\.format|json_object|text format|format|text field)/i.test(errorText);
  return reasoning && jsonFormat ? "both" : reasoning ? "reasoning" : jsonFormat ? "text" : null;
}

export async function requestResponsesFaqSelection({ url, key, model, messages, fetchImpl = fetch, minimalFirst = false, outputTokenLimit = null }) {
  let mode = minimalFirst ? "minimal" : "full";
  // One bounded retry helps with brief 503 gateway/channel overloads.
  // Persistent upstream outages still surface as failure; do not endlessly
  // retry, switch groups, or silently change model/provider.
  let retried503 = false;
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetchImpl(url, {
      method: "POST",
      headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
      body: JSON.stringify(responsesFaqPayload({ model, messages, mode, outputTokenLimit })),
      redirect: "error",
      signal: AbortSignal.timeout(25000), cache: "no-store"
    });
    if (response.ok) {
      let data;
      try { data = JSON.parse(await providerText(response)); }
      catch {
        reportInvalidPayload(response, null, "non_json");
        throw new Error("Empty or invalid AI provider response");
      }
      if (data?.status === "failed" || data?.status === "incomplete") {
        throw new Error("Empty or invalid AI provider response: incomplete");
      }
      const content = extractAssistantText(data);
      if (!content) {
        reportInvalidPayload(response, data, "missing_assistant_text");
        throw new Error("Empty or invalid AI provider response");
      }
      return content;
    }
    // Log only safe status and boolean error characteristics. Upstream response
    // bodies may include prompts, account data, or secrets; never log raw text.
    const errorText = (await providerText(response)).slice(0, 1500);
    let parsedError = {};
    try { parsedError = JSON.parse(errorText); } catch { /* non-JSON upstream */ }
    const errorObj = parsedError && typeof parsedError === "object"
      ? (parsedError.error && typeof parsedError.error === "object" ? parsedError.error : parsedError)
      : {};
    const allowedCodes = new Set([
      "invalid_request_error", "authentication_error", "permission_error",
      "rate_limit_exceeded", "insufficient_quota", "model_not_found",
      "not_found", "server_error", "bad_request", "invalid_api_key"
    ]);
    const errorCode = typeof errorObj.code === "string" && allowedCodes.has(errorObj.code)
      ? errorObj.code : "unclassified";
    console.warn("Miaoqu Responses upstream rejection", {
      httpStatus: response.status,
      errorCode,
      looksLikeHtml: /html/i.test(response.headers.get("content-type") || ""),
      mentionsReasoning: /reasoning|effort/i.test(errorText),
      mentionsTextFormat: /json_object|text[.]format|text format|response_format/i.test(errorText),
      mentionsInput: /(?:^|[^a-z])input(?:[^a-z]|$)/i.test(errorText),
      mentionsModel: /(?:^|[^a-z])model(?:[^a-z]|$)/i.test(errorText),
      mentionsStore: /(?:^|[^a-z])store(?:[^a-z]|$)/i.test(errorText),
      attempt: attempt + 1
    });
    if (response.status === 503 && !retried503 && attempt < 2) {
      retried503 = true;
      // Bound the extra load on the provider. Authentication, quota errors,
      // and malformed API requests are never retried.
      await new Promise(resolve => setTimeout(resolve, 750));
      continue;
    }
    if ((response.status === 400 || response.status === 422) && attempt < 2) {
      const unsupported = unsupportedResponsesParameter(errorText);
      if (unsupported && mode !== "plain") {
        mode = mode === "full"
          ? unsupported === "reasoning" ? "json" : unsupported === "text" ? "reasoning" : "plain"
          : "plain";
        continue;
      }
    }
    throw new Error("AI provider returned HTTP " + response.status);
  }
  throw new Error("AI provider returned incompatible response");
}


/**
 * Provider protocol is explicit: never guess or automatically fall back to
 * another endpoint with the same API credential. The OpenCode JSON supplied
 * by the team uses Anthropic Messages, whereas Kimi commonly uses OpenAI
 * Chat Completions. Neither implies the provider account can access a model.
 */
export function aiProtocol(env = process.env) {
  const protocol = (env.AI_API_STYLE || "responses").trim().toLowerCase();
  if (!["responses", "chat_completions", "anthropic"].includes(protocol))
    throw new Error("Unsupported AI_API_STYLE");
  return protocol;
}

export function modelEndpoint(baseUrl, protocol) {
  if (!["responses", "chat_completions", "anthropic"].includes(protocol))
    throw new Error("Unsupported AI_API_STYLE");
  const url = new URL(chatEndpoint(baseUrl));
  let path = url.pathname.replace(/\/(?:responses|messages|chat\/completions)$/, "");
  if (!path.endsWith("/v1")) throw new Error("AI_BASE_URL must end with /v1 or a supported API path");
  url.pathname = path + (protocol === "anthropic" ? "/messages" :
    protocol === "chat_completions" ? "/chat/completions" : "/responses");
  return url.toString();
}

export function anthropicPayload(model, messages) {
  const system = messages.filter(m=>m.role==="system").map(m=>m.content).join("\n");
  const turns = messages.filter(m=>m.role === "user" || m.role === "assistant")
    .map(m=>({role:m.role,content:m.content}));
  if(!turns.length) throw new Error("No user message for AI request");
  return {model,max_tokens:1024,system,messages:turns,stream:false};
}

export function extractAnthropicAssistantText(value) {
  if (!value || value.type !== "message" || value.role !== "assistant" ||
      !Array.isArray(value.content) || value.error ||
      ["max_tokens","tool_use","refusal"].includes(value.stop_reason)) return null;
  if (value.content.some(item => !["text","thinking","redacted_thinking"].includes(item?.type))) return null;
  const text = value.content.filter(item => item.type === "text" && typeof item.text === "string")
    .map(item => item.text).join("");
  return text.trim() || null;
}

export async function requestModelText({
  baseUrl, key, model, messages, protocol = "responses", fetchImpl = fetch, outputTokenLimit = null
}) {
  if(protocol==="responses") {
    return requestResponsesFaqSelection({
      url:modelEndpoint(baseUrl,protocol),key,model,messages,fetchImpl,minimalFirst:true,outputTokenLimit
    });
  }
  const url=modelEndpoint(baseUrl,protocol);
  const headers={"Content-Type":"application/json"};
  let payload;
  if(protocol==="anthropic") {
    headers["x-api-key"]=key;
    headers["anthropic-version"]="2023-06-01";
    payload=anthropicPayload(model,messages);
  } else {
    headers.Authorization="Bearer "+key;
    payload={model,messages,stream:false};
  }
  if (outputTokenLimit != null) {
    if (!Number.isInteger(outputTokenLimit) || outputTokenLimit < 128 || outputTokenLimit > 2048) throw new Error("Invalid output token limit");
    payload.max_tokens = outputTokenLimit;
  }
  const response=await fetchImpl(url,{
    method:"POST",headers,body:JSON.stringify(payload),redirect:"error",
    signal:AbortSignal.timeout(25000),cache:"no-store"
  });
  if(!response.ok) {
    // Do not expose or log a raw upstream error containing secrets or prompts.
    console.warn("AI provider request rejected", {protocol,httpStatus:response.status});
    throw new Error("AI provider returned HTTP "+response.status);
  }
  let data;
  try {data=JSON.parse(await providerText(response));}
  catch {
    reportInvalidPayload(response,null,"non_json");
    throw new Error("Empty or invalid AI provider response");
  }
  const text=protocol==="anthropic" ? extractAnthropicAssistantText(data)
    : extractAssistantText(data);
  if(!text) {
    reportInvalidPayload(response,data,"missing_assistant_text");
    throw new Error("Empty or invalid AI provider response");
  }
  return text;
}

export async function selectFaq({ message, language, history = [], faqs }) {
  if (classifyInput(message, language).status !== "allowed") return null;
  const safeHistory = sanitizeFaqHistory(history);
  const safeMessage = redactSensitiveText(message);
  if (mockAiEnabled()) return matchFaqOffline(safeMessage, faqs, safeHistory);
  const candidates = shortlistFaqs(safeMessage, faqs, safeHistory);
  if (!candidates.length) return null;
  const { AI_BASE_URL, AI_MODEL } = process.env;
  const key = resolveAiApiKey();
  if (![AI_BASE_URL, key, AI_MODEL].every(hasConfiguredValue)) throw new Error("AI provider not configured");
  const content = await requestModelText({
    baseUrl: AI_BASE_URL, key, model: AI_MODEL, protocol: aiProtocol(),
    outputTokenLimit: 384,
    messages: buildMessages({ message: safeMessage, language, history: safeHistory, faqs: candidates })
  });
  const selection = parseFaqSelection(content, candidates);
  if (!selection) {
    const id = '"faqId"\\s*:\\s*(?:"CN[0-9]{3}"|null)';
    const number = '"confidence"\\s*:\\s*(?:0|1)(?:\\.[0-9]+)?(?:[eE][+-]?[0-9]+)?';
    // An explicit structured no-match differs from a malformed gateway reply.
    // Malformed output triggers the deterministic fallback instead of silently
    // turning every answerable question into an ordinary scope refusal.
    if (typeof content !== "string" || content.length > 500 || !new RegExp('^\\s*\\{\\s*(?:' + id + '\\s*,\\s*' + number + '|' + number + '\\s*,\\s*' + id + ')\\s*\\}\\s*$').test(content))
      throw new Error("Empty or invalid AI provider response");
  }
  return selection;
}
