import { FAQ_MATCH_SYSTEM_PROMPT } from "./prompts.js";
import { hasConfiguredValue, mockAiEnabled } from "../config.js";
import { matchFaqOffline } from "../tourism/faq-matching.js";

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
  if (!url.pathname.endsWith("/chat/completions")) url.pathname = url.pathname.replace(/\/$/, "") + "/chat/completions";
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

export async function selectFaq({ message, language, history = [], faqs }) {
  if (mockAiEnabled()) return matchFaqOffline(message, faqs, history);
  const { AI_BASE_URL, AI_API_KEY, AI_MODEL } = process.env;
  if (![AI_BASE_URL, AI_API_KEY, AI_MODEL].every(hasConfiguredValue)) throw new Error("AI provider not configured");
  const response = await fetch(chatEndpoint(AI_BASE_URL), {
    method: "POST",
    headers: { Authorization: "Bearer " + AI_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ model: AI_MODEL, messages: buildMessages({ message, language, history, faqs }), temperature: 0, max_tokens: 80, stream: false }),
    signal: AbortSignal.timeout(25000), cache: "no-store"
  });
  if (!response.ok) throw new Error("AI provider returned HTTP " + response.status);
  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) throw new Error("Empty or invalid AI provider response");
  return parseFaqSelection(content, faqs);
}
