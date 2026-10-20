import { FAQ_MATCH_SYSTEM_PROMPT } from "./prompts.js";
import { hasConfiguredValue, mockAiEnabled } from "../config.js";
import { matchFaqOffline, shortlistFaqs } from "../tourism/faq-matching.js";

export function buildMessages({ message, language, history = [], faqs = [] }) {
  const reference = faqs.map(({ id, category, question_en, question_zh, answer_en, aliases }) => ({ id, category, question_en, question_zh, answer: answer_en, aliases }));
  const system = FAQ_MATCH_SYSTEM_PROMPT + "\nResponse language: " + language + "\nFAQ REFERENCE DATA:\n" + JSON.stringify(reference);
  const safeHistory = history.slice(-12).filter((m) => m && ["user", "assistant"].includes(m.role) && typeof m.content === "string")
    .map(({ role, content }) => ({ role, content: content.slice(0, 1500) }));
  return [{ role: "system", content: system }, ...safeHistory, { role: "user", content: message }];
}

export function chatEndpoint(baseUrl) {
  const url = new URL(baseUrl);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))) throw new Error("AI_BASE_URL must be HTTPS, or HTTP on localhost");
  // The configured provider URL is the actual POST destination. Do not append /chat/completions.
  url.pathname = url.pathname.replace(/\/+$/, "") || "/";
  url.search = "";
  return url.toString();
}

export function parseFaqSelection(content, faqs) {
  if (typeof content !== "string" || content.length > 500) return null;
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
    const choice = root.choices?.[0];
    if (choice?.finish_reason === "length") throw new Error("Empty or invalid AI provider response: length");
    if (choice && choice.finish_reason !== "content_filter") {
      const content = unwrapContent(choice.message?.content ?? choice.text);
      if (content) return content;
    }
    if (root.status === "incomplete" || root.status === "failed") throw new Error("Empty or invalid AI provider response: incomplete");
    const direct = unwrapContent(root.output_text);
    if (direct) return direct;
    if (Array.isArray(root.output)) {
      for (const item of root.output) {
        if (item?.type !== "message" || item.role !== "assistant") continue;
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
  console.warn("AI provider unexpected response shape", {
    reason,
    httpStatus: response.status,
    contentType: (response.headers.get("content-type") || "unknown").slice(0, 60),
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
      signal: AbortSignal.timeout(25000), cache: "no-store"
    });
    if (response.ok) {
      let data;
      try { data = await response.json(); }
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
      const errorText = (await response.text()).slice(0, 1500);
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

export function responsesFaqPayload({ model, messages, mode = "full" }) {
  const payload = { model, input: messages, stream: false, store: false };
  // Use only documented Responses API fields; no messages, thinking, or
  // response_format keys from Chat Completions.
  if (mode !== "plain") payload.reasoning = { effort: "none" };
  if (mode === "full" || mode === "json") payload.text = { format: { type: "json_object" } };
  return payload;
}

function unsupportedResponsesParameter(errorText) {
  if (!/(unknown|unsupported|unrecognized|invalid|not supported|extra field|extra_forbidden)/i.test(errorText)) return null;
  const reasoning = /(?:reasoning|effort)/i.test(errorText);
  const jsonFormat = /(?:text\\.format|json_object|text format|format|text field)/i.test(errorText);
  return reasoning && jsonFormat ? "both" : reasoning ? "reasoning" : jsonFormat ? "text" : null;
}

export async function requestResponsesFaqSelection({ url, key, model, messages, fetchImpl = fetch }) {
  let mode = "full";
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetchImpl(url, {
      method: "POST",
      headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
      body: JSON.stringify(responsesFaqPayload({ model, messages, mode })),
      signal: AbortSignal.timeout(25000), cache: "no-store"
    });
    if (response.ok) {
      let data;
      try { data = await response.json(); }
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
    if ((response.status === 400 || response.status === 422) && attempt < 2) {
      const errorText = (await response.text()).slice(0, 1500);
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

export async function selectFaq({ message, language, history = [], faqs }) {
  if (mockAiEnabled()) return matchFaqOffline(message, faqs, history);
  const candidates = shortlistFaqs(message, faqs, history);
  if (!candidates.length) return null;
  const { AI_BASE_URL, AI_API_KEY, AI_MODEL } = process.env;
  if (![AI_BASE_URL, AI_API_KEY, AI_MODEL].every(hasConfiguredValue)) throw new Error("AI provider not configured");
  const content = await requestResponsesFaqSelection({ url: responsesEndpoint(AI_BASE_URL), key: AI_API_KEY,
    model: AI_MODEL, messages: buildMessages({ message, language, history, faqs: candidates }) });
  return parseFaqSelection(content, candidates);
}
