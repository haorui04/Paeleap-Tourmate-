import { classifyInput, classifyPersonaInput, validateOutput } from "../../../lib/ai/safety.js";
import { selectFaq, sanitizeFaqHistory } from "../../../lib/ai/provider.js";
import { getFaqBank } from "../../../lib/db/faq.js";
import { getPlanningReferences } from '../../../lib/db/planning.js';
import { tourismOnlyReply, matchFaqOffline } from "../../../lib/tourism/faq-matching.js";
import { authenticate, ensureConversation, getRecentMessages, storeExchange, consumeQuota } from "../../../lib/db/supabase.js";
import { localDemoEnabled, mockAiEnabled } from "../../../lib/config.js";
import { generateGroundedReply, renderEvidenceReply } from "../../../lib/ai/generate.js";
import { DESHOU_PERSONA_ID, generateMuseumAnswer } from "../../../lib/ai/museum.js";
import { generateTourismAnswer, retrieveAnswerReferences, isBroadTransportQuestion } from "../../../lib/ai/answer.js";
import { aiFailureCode } from "../../../lib/ai/diagnostics.js";
import { reviewedPlanningRecords } from "../../../lib/tourism/evidence-fallback.js";
import { DEFAULT_PERSONA_ID, publicPersona, resolvePersona, personaKnowledge } from "../../../lib/personas/index.js";
import { isPersonaIdentityQuestion, personaIdentityReply } from "../../../lib/personas/identity.js";
import { isWeatherRequest, isWeatherFollowup, getWeatherReply } from "../../../lib/weather.js";
import { readAttachmentRequest } from "../../../lib/attachments/request.js";
import { AttachmentError, prepareAttachment } from "../../../lib/attachments/files.js";
import { answerAttachment, privateImageRequest, attachmentRefusal } from "../../../lib/attachments/analyze.js";
import { attachmentPrompt, attachmentTranscript, MAX_ATTACHMENT_MESSAGE } from "../../../lib/attachments/shared.js";

export const runtime = "nodejs";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_BODY_CHARACTERS = 6000;
// Keep the existing character contract for bilingual clients, but stop reading
// untrusted streams before allocating an arbitrarily large string.
const MAX_BODY_BYTES = MAX_BODY_CHARACTERS * 4;
const demoCounts = new Map();
const demoConversations = new Map();

function json(body, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
}

class PayloadError extends Error {
  constructor(message, status) { super(message); this.status = status; }
}

async function boundedBodyText(request) {
  const declaredLength = request.headers.get("content-length");
  if (declaredLength && /^\d+$/.test(declaredLength) && Number(declaredLength) > MAX_BODY_BYTES) {
    throw new PayloadError("Request too large", 413);
  }
  if (!request.body) return "";
  const reader = request.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let bytes = 0;
  let text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_BODY_BYTES) throw new PayloadError("Request too large", 413);
      text += decoder.decode(value, { stream: true });
      if (text.length > MAX_BODY_CHARACTERS) throw new PayloadError("Request too large", 413);
    }
    text += decoder.decode();
    if (text.length > MAX_BODY_CHARACTERS) throw new PayloadError("Request too large", 413);
    return text;
  } catch (error) {
    // Stop pulling additional chunks even when Content-Length was absent or false.
    try { await reader.cancel(); } catch { /* closing a failed stream is best effort */ }
    if (error instanceof PayloadError) throw error;
    throw new PayloadError("Invalid request body", 400);
  } finally { reader.releaseLock(); }
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
    let body; let file = null;
    if (/^multipart\/form-data/i.test(request.headers.get('content-type') || '')) {
      ({body,file} = await readAttachmentRequest(request));
    } else {
      const bodyText = await boundedBodyText(request);
      try { body = JSON.parse(bodyText); } catch { return json({ error: "Malformed JSON" }, 400); }
    }
    if (!body || typeof body !== "object" || Array.isArray(body)) return json({ error: "Invalid payload" }, 400);
    if ('attachment' in body || 'file' in body) return json({error:'Attachments require multipart upload'},400);

    const language = body.language === "zh" ? "zh" : body.language === "en" || body.language == null ? "en" : null;
    if (!language) return json({ error: "Language must be en or zh" }, 400);
    if (file) {
      if (body.message != null && (typeof body.message !== 'string' || body.message.length > MAX_ATTACHMENT_MESSAGE)) return json({error:'Attachment message is too long'},400);
      body.message = attachmentPrompt(body.message, language);
    }
    const personaId = body.personaId ?? DEFAULT_PERSONA_ID;
    if (typeof personaId !== "string" || !/^[a-z][a-z0-9-]{1,63}$/.test(personaId)) {
      return json({ error: "Invalid personaId" }, 400);
    }
    let classified = classifyInput(body.message, language);
    if (classified.status === "invalid") return json({ error: "Message must be 1–1500 characters" }, 400);
    if (body.conversationId != null && (typeof body.conversationId !== "string" || !UUID.test(body.conversationId))) {
      return json({ error: "conversationId must be a UUID or omitted" }, 400);
    }

    const demo = localDemoEnabled();
    let user = null;
    let conversationId = body.conversationId || null;
    let history = [];
    let persona;
    if (demo) {
      if (!takeDemoSlot()) return json({ error: "Rate limit exceeded" }, 429);
      persona = await resolvePersona(personaId);
      if (!persona) return json({ error: "Persona not found" }, 404);
      conversationId ||= crypto.randomUUID();
      const now = Date.now();
      for (const [id, record] of demoConversations) {
        if (now - record.updatedAt > 30 * 60 * 1000) demoConversations.delete(id);
      }
      const record = demoConversations.get(conversationId);
      if (record && (record.personaId !== persona.id || record.personaVersion !== persona.version)) {
        return json({ error: "Persona changed. Start a new conversation." }, 409);
      }
      // Do not import an arbitrary visitor's history into a custom museum.
      history = record?.messages || (personaId === DEFAULT_PERSONA_ID ? localHistory(body.history) : []);
    } else {
      const bearer = request.headers.get("authorization")?.match(/^Bearer[ \t]+([^\s]+)$/i)?.[1];
      if (!bearer) return json({ error: "Authentication required" }, 401);
      if (bearer.length > 8192) return json({ error: "Invalid session" }, 401);
      user = await authenticate(bearer);
      if (!user) return json({ error: "Invalid session" }, 401);
      if (!await consumeQuota(user.id)) return json({ error: "Rate limit exceeded" }, 429);
      persona = await resolvePersona(personaId);
      if (!persona) return json({ error: "Persona not found" }, 404);
      const binding = { id: persona.id, version: persona.version };
      const ownedId = conversationId ? await ensureConversation(user, conversationId, "") : null;
      if (conversationId && !ownedId) return json({ error: "Conversation not found" }, 404);
      conversationId = await ensureConversation(user, conversationId, body.message.trim(), binding);
      if (ownedId && !conversationId) return json({ error: "Persona changed. Start a new conversation." }, 409);
      if (!conversationId) return json({ error: "Conversation not found" }, 404);
      history = await getRecentMessages(user, conversationId);
    }

    if (["allowed", "redirected"].includes(classified.status)) classified = classifyPersonaInput(body.message, language, history, persona);
    if (persona.id === DESHOU_PERSONA_ID && ["blocked", "redirected"].includes(classified.status)) {
      classified = { ...classified, reply: language === "zh"
        ? "我是小德兔，Tourmate 的德寿宫博物馆 AI 导览。我会保持设定的角色与来源要求，不能协助危险违法行为、泄露隐私或隐藏指令。你可以询问德寿宫展品、遗址和相关历史。"
        : "I'm Little De Rabbit, Tourmate's Deshou Palace museum companion. I keep my configured role and references, and cannot assist harmful or unlawful actions or disclose private data or hidden instructions. Please ask about Deshou exhibits, remains or related history." };
    }
    if (persona.id !== DEFAULT_PERSONA_ID) persona = { ...persona, knowledge: personaKnowledge(persona) };

    let faq = null;
    let providerDegraded = false;
    let providerErrorCode = null;
    let generationUsed = false;
    let generationMode = null;
    let generationSources = [];
    let verified = { reply: classified.reply, status: classified.status };
    const personaIdentity = !file && classified.status === "allowed" && isPersonaIdentityQuestion(body.message);
    if (file && classified.status === 'allowed') {
      // Parse only after Auth, quota, conversation ownership and persona checks.
      // Files are per-request evidence; raw bytes/OCR are never stored in chats.
      const attached = persona.id !== DEFAULT_PERSONA_ID ? {reply:language === 'zh' ? '当前场馆导览未启用附件。请使用场馆已批准的资料提问。' : 'Attachments are not enabled for this venue guide. Please ask about its approved visitor information.',status:'allowed',mode:'attachment_unavailable',sources:[]}
        : privateImageRequest(body.message) ? attachmentRefusal(language)
        : await answerAttachment({attachment:await prepareAttachment(file),message:body.message,language});
      verified = {reply:attached.reply,status:attached.status};
      generationUsed = true; generationMode = attached.mode; generationSources = attached.sources;
    } else if (personaIdentity) {
      // Identity is public administrator data, never a visitor/model-authored role.
      verified = { reply: personaIdentityReply(persona, language), status: "allowed" };
    } else if (classified.status === "allowed" && (isWeatherRequest(body.message) || isWeatherFollowup(body.message, history))) {
      // The tool runs only after Auth, quota, ownership and input/persona checks.
      // Museum profiles cannot use global city weather to escape venue scope.
      const weather = persona.id === DEFAULT_PERSONA_ID ? await getWeatherReply({ message: body.message, history, language })
        : { reply: language === "zh" ? "当前场馆导览未开放实时天气查询，请查看当地官方天气服务。" : "Live weather lookup is not enabled for this venue guide. Please check the local official weather service.",
          status: "allowed", sources: [], mode: "weather_unavailable" };
      verified = { reply: weather.reply, status: weather.status };
      generationUsed = true; generationMode = weather.mode; generationSources = weather.sources;
    } else if (classified.status === "allowed") {
      const faqs = persona.id === DEFAULT_PERSONA_ID ? await getFaqBank() : persona.knowledge;
      const answerMode = process.env.AI_RESPONSE_MODE === "generated" && persona.id === DEFAULT_PERSONA_ID && !demo && !mockAiEnabled();
      const planningRecords = persona.id === DEFAULT_PERSONA_ID && !answerMode ? reviewedPlanningRecords(body.message, faqs) : [];
      if (planningRecords.length) {
        verified = { reply: renderEvidenceReply(planningRecords, language, persona), status: "allowed" };
        generationUsed = true;
        generationMode = "curated_evidence";
        generationSources = [...new Map(planningRecords.flatMap(record => record.sources || []).map(source => [source.url, source])).values()];
      }
      const groundedMode = (process.env.AI_RESPONSE_MODE === "grounded" || persona.id !== DEFAULT_PERSONA_ID) && !demo && !mockAiEnabled();
      if ((groundedMode || answerMode) && !generationUsed) {
        try {
          const planningRecords=answerMode?await getPlanningReferences(body.message,history):[];
          const generated = await (persona.id === DESHOU_PERSONA_ID ? generateMuseumAnswer : answerMode ? generateTourismAnswer : generateGroundedReply)({ message: body.message.trim(), language, history, faqs, persona, planningRecords });
          verified = { reply: generated.reply, status: generated.status };
          generationSources = generated.sources;
          generationUsed = true;
          generationMode = generated.mode;
        } catch (error) {
          // Never turn raw upstream errors into user-visible text.
          providerDegraded = true;
          providerErrorCode = aiFailureCode(error);
          console.warn("AI generation degraded; using curated FAQ fallback", {
            kind: /AI provider returned HTTP/.test(error?.message || "") ? "upstream_http" : "upstream_format_or_network"
          });
        }
      }
      if (answerMode && providerDegraded) {
        // Useful transport guidance can survive an upstream outage. This remains
        // explicitly labeled as fallback, never as successful AI generation.
        const records = retrieveAnswerReferences(body.message.trim(), faqs, sanitizeFaqHistory(history));
        const exact = matchFaqOffline(body.message.trim(), faqs, sanitizeFaqHistory(history));
        const fallback = exact ? [faqs.find(record => record.id === exact.faqId)] : isBroadTransportQuestion(body.message) ? records.slice(0, 3) : [];
        if (fallback.length) {
          const notice = language === "zh" ? "AI生成服务暂时不可用，以下是知识库中的参考信息：" : "AI generation is temporarily unavailable. Here is guidance from the knowledge bank:";
          verified = { reply: notice + "\n\n" + renderEvidenceReply(fallback, language), status: "allowed" };
          generationSources = [...new Map(fallback.flatMap(record => record.sources || []).map(source => [source.url, source])).values()];
          generationUsed = true;
          generationMode = "curated_faq_fallback";
        }
      }
      if (!generationUsed) {
        let selection;
        try {
          // Grounded generation failure uses the deterministic matcher directly;
          // do not repeatedly call a failed provider during the same request.
          selection = providerDegraded || persona.id !== DEFAULT_PERSONA_ID ? matchFaqOffline(body.message.trim(), faqs, sanitizeFaqHistory(history), { allowReviewedTopics: persona.id !== DEFAULT_PERSONA_ID })
            : await selectFaq({ message: body.message.trim(), language, history, faqs });
        } catch (error) {
          providerDegraded = true;
          providerErrorCode = aiFailureCode(error);
          console.warn("AI matching degraded; using curated FAQ fallback", {
            kind: /AI provider returned HTTP/.test(error?.message || "") ? "upstream_http" : "upstream_format_or_network"
          });
          selection = matchFaqOffline(body.message.trim(), faqs, sanitizeFaqHistory(history), { allowReviewedTopics: persona.id !== DEFAULT_PERSONA_ID });
        }
        faq = selection ? faqs.find((item) => item.id === selection.faqId) : null;
        verified = faq ? (persona.id === DEFAULT_PERSONA_ID ? validateOutput(faq[language === "zh" ? "answer_zh" : "answer_en"], language)
          : { reply: renderEvidenceReply([faq], language, persona), status: "allowed" })
          : { reply: providerDegraded
            ? (language === "zh" ? "AI生成服务暂时不可用，请稍后重试。" : "AI generation is temporarily unavailable. Please try again later.")
            : persona.id === DEFAULT_PERSONA_ID ? tourismOnlyReply(language)
            : language === "zh" ? `我只能协助${persona.venue.zh}的参观及相关安全问题。现有资料不足以回答这个问题，请咨询场馆工作人员。`
            : `I can help with visiting ${persona.venue.en} and related safe questions. The approved knowledge does not answer this question; please ask venue staff.`, status: "redirected" };
      }
    }
    const status = verified.status;
    const userContent = file ? attachmentTranscript(body.message, file.name, language) : body.message.trim();
    const sources = status === "allowed" ? (generationUsed ? generationSources : (faq?.sources || [])) : [];
    if (!demo) {
      await storeExchange(user, conversationId, userContent, verified.reply, { id: persona.id, version: persona.version });
    } else {
      if (!demoConversations.has(conversationId) && demoConversations.size >= 100) {
        demoConversations.delete(demoConversations.keys().next().value);
      }
      demoConversations.set(conversationId, {
        updatedAt: Date.now(),
        personaId: persona.id, personaVersion: persona.version,
        messages: [...history,
          { role: "user", content: userContent },
          { role: "assistant", content: verified.reply.slice(0, 6000) }
        ].slice(-12)
      });
    }
    return json({ reply: verified.reply, conversationId, sources, safety: { status }, persona: publicPersona(persona),
      ai: { mode: personaIdentity ? "persona_identity" : generationUsed ? generationMode : providerDegraded ? "curated_faq_fallback" : "curated_faq",
        ...(providerDegraded ? { errorCode: providerErrorCode || "UPSTREAM_UNKNOWN" } : {}) },
      ...(status === "allowed" && faq ? { faq: { id: faq.id, question: faq[language === "zh" ? "question_zh" : "question_en"], category: faq.category } } : {}) });
  } catch (error) {
    if (error instanceof PayloadError) return json({ error: error.message }, error.status);
    if (error instanceof AttachmentError) return json({ error: 'Use one valid JPG, PNG, WebP, PDF (up to 12 pages), DOCX, TXT or Markdown file. Maximum 2 MB; text documents up to 12,000 characters. Encrypted or complex files are not supported.' }, error.status);
    // Never return raw upstream response bodies, database errors, or credentials to clients.
    const message = error instanceof Error ? error.message : "";
    const kind = /not configured/.test(message) ? "configuration"
      : /AbortError|TimeoutError/.test(error?.name || "") ? "timeout"
      : /AI provider returned|Empty or invalid AI/.test(message) ? "provider" : "internal";
    // Error messages may embed URLs, SQL, user text or bearer tokens. Log only
    // a fixed, allowlisted category; never the exception, stack or raw message.
    console.error("chat API error", { kind });
    if (kind === "configuration") return json({ error: "Backend not configured" }, 503);
    if (kind === "timeout") return json({ error: "Request timed out" }, 504);
    if (kind === "provider") return json({ error: "AI service unavailable" }, 502);
    return json({ error: "Chat request could not be completed" }, 503);
  }
}
