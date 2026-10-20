import { classifyInput, validateOutput } from "../../../lib/ai/safety.js";
import { selectFaq } from "../../../lib/ai/provider.js";
import { getFaqBank } from "../../../lib/db/faq.js";
import { tourismOnlyReply } from "../../../lib/tourism/faq-matching.js";
import { authenticate, ensureConversation, getRecentMessages, storeExchange, consumeQuota } from "../../../lib/db/supabase.js";
import { localDemoEnabled } from "../../../lib/config.js";

export const runtime = "nodejs";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const demoCounts = new Map();
const demoConversations = new Map();

function json(body, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function takeDemoSlot() {
  const bucket = Math.floor(Date.now() / 60000);
  // Local-development-only in-memory limiter; production uses atomic PostgreSQL quota.
  const record = demoCounts.get(bucket) ?? 0;
  if (record >= 6) return false;
  demoCounts.clear();
  demoCounts.set(bucket, record + 1);
  return true;
}

function localHistory(value) {
  if (!Array.isArray(value)) return [];
  // Browser history is permitted only in local mode and cannot add system roles.
  const history = value.slice(-12).filter((message) => message &&
    ["user", "assistant"].includes(message.role) && typeof message.content === "string")
    .map(({ role, content }) => ({ role, content: content.slice(0, 1500) }));
  return JSON.stringify(history).length <= 2100 ? history : [];
}

export async function POST(request) {
  try {
    const bodyText = await request.text();
    if (bodyText.length > 6000) return json({ error: "Request too large" }, 413);
    let body;
    try { body = JSON.parse(bodyText); } catch { return json({ error: "Malformed JSON" }, 400); }
    if (!body || typeof body !== "object" || Array.isArray(body)) return json({ error: "Invalid payload" }, 400);

    const language = body.language === "zh" ? "zh" : body.language === "en" || body.language == null ? "en" : null;
    if (!language) return json({ error: "Language must be en or zh" }, 400);
    const classified = classifyInput(body.message, language);
    if (classified.status === "invalid") return json({ error: "Message must be 1–1500 characters" }, 400);
    if (body.conversationId != null && (typeof body.conversationId !== "string" || !UUID.test(body.conversationId))) {
      return json({ error: "conversationId must be a UUID or omitted" }, 400);
    }

    const demo = localDemoEnabled();
    let user = null;
    let conversationId = body.conversationId || null;
    let history = [];
    if (demo) {
      if (!takeDemoSlot()) return json({ error: "Rate limit exceeded" }, 429);
      conversationId ||= crypto.randomUUID();
      const now = Date.now();
      for (const [id, record] of demoConversations) {
        if (now - record.updatedAt > 30 * 60 * 1000) demoConversations.delete(id);
      }
      history = demoConversations.get(conversationId)?.messages || localHistory(body.history);
    } else {
      const bearer = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
      if (!bearer) return json({ error: "Authentication required" }, 401);
      user = await authenticate(bearer);
      if (!user) return json({ error: "Invalid session" }, 401);
      if (!await consumeQuota(user.id)) return json({ error: "Rate limit exceeded" }, 429);
      conversationId = await ensureConversation(user, conversationId, body.message.trim());
      if (!conversationId) return json({ error: "Conversation not found" }, 404);
      history = await getRecentMessages(user, conversationId);
    }

    let faq = null;
    let verified = { reply: classified.reply, status: classified.status };
    if (classified.status === "allowed") {
      const faqs = await getFaqBank();
      const selection = await selectFaq({ message: body.message.trim(), language, history, faqs });
      faq = selection ? faqs.find((item) => item.id === selection.faqId) : null;
      verified = faq ? validateOutput(faq[language === "zh" ? "answer_zh" : "answer_en"], language)
        : { reply: tourismOnlyReply(language), status: "redirected" };
    }
    const status = verified.status;
    const sources = status === "allowed" && faq ? faq.sources : [];
    if (!demo) {
      await storeExchange(conversationId, body.message.trim(), verified.reply);
    } else {
      if (!demoConversations.has(conversationId) && demoConversations.size >= 100) {
        demoConversations.delete(demoConversations.keys().next().value);
      }
      demoConversations.set(conversationId, {
        updatedAt: Date.now(),
        messages: [...history,
          { role: "user", content: body.message.trim() },
          { role: "assistant", content: verified.reply.slice(0, 6000) }
        ].slice(-12)
      });
    }
    return json({ reply: verified.reply, conversationId, sources, safety: { status },
      ...(status === "allowed" && faq ? { faq: { id: faq.id, question: faq[language === "zh" ? "question_zh" : "question_en"], category: faq.category } } : {}) });
  } catch (error) {
    // Never return raw upstream response bodies, database errors, or credentials to clients.
    console.error("chat API error:", error instanceof Error ? error.message : "unknown");
    const message = error instanceof Error ? error.message : "";
    if (/not configured/.test(message)) return json({ error: "Backend not configured" }, 503);
    if (/AbortError|TimeoutError/.test(error?.name || "")) return json({ error: "Request timed out" }, 504);
    if (/AI provider returned|Empty or invalid AI/.test(message)) return json({ error: "AI service unavailable" }, 502);
    return json({ error: "Chat request could not be completed" }, 503);
  }
}
