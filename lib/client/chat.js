import { isPersonaId, parsePublicPersona } from "./personas.js";

export const MAX_MESSAGE_LENGTH = 1500;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const COPY = {
  en: {
    400: "Please check your message and try again.",
    401: "Your session has expired. Sign in again to continue.",
    404: "This conversation is no longer available. Start a new trip to continue.",
    409: "This assistant profile has changed. Start a new trip; your earlier conversation is still saved.",
    413: "Keep messages under 1,500 characters and attachments under 2 MB (text: 12,000 characters).",
    415: "Use a valid JPG, PNG, WebP, PDF (up to 12 pages), DOCX, TXT or Markdown file. Encrypted, animated or complex files are not supported.",
    429: "You have reached the six-message-per-minute limit. Please wait a moment.",
    502: "The AI service is temporarily unavailable. Please try again shortly.",
    503: "The assistant is not fully configured yet. Check the environment setup.",
    504: "The request took too long. Please try again.",
    offline: "The assistant could not be reached. Check your connection and try again.",
    conversation_create: "Your saved conversation could not be started. Please try again, or sign out and sign in again if this continues.",
    invalid_response: "The server returned an unreadable chat response. Please refresh the page and try again.",
    stopped: "Response stopped."
  },
  zh: {
    400: "请检查消息内容后重试。",
    401: "登录已过期，请重新登录后继续。",
    404: "此对话已不可用，请开始新的行程对话。",
    409: "助手配置已更新，请开始新行程。原有对话仍会保留。",
    413: "消息限 1,500 字符，附件限 2 MB，文档文本限 12,000 字符。",
    415: "请使用有效的 JPG、PNG、WebP、PDF（最多 12 页）、DOCX、TXT 或 Markdown 文件。不支持加密、动画或复杂文件。",
    429: "已达到每分钟六条消息的限制，请稍后再试。",
    502: "AI 服务暂时不可用，请稍后重试。",
    503: "助手尚未完成配置，请检查环境设置。",
    504: "请求超时，请重试。",
    offline: "无法连接到助手，请检查网络后重试。",
    conversation_create: "未能创建已保存对话。请重试；如仍失败，请退出后重新登录。",
    invalid_response: "服务器返回的对话格式无法读取，请刷新页面后重试。",
    stopped: "已停止生成回复。"
  }
};

export const SAFETY_LABELS = {
  en: {
    allowed: "Reference-based response",
    blocked: "Unsafe request blocked",
    emergency: "Urgent safety guidance",
    redirected: "Outside this guide's scope",
    sanitized: "Unverified details removed"
  },
  zh: {
    allowed: "参考资料答复",
    blocked: "已拦截不安全请求",
    emergency: "紧急安全提示",
    redirected: "超出当前导览范围",
    sanitized: "已移除未核实信息"
  }
};

export function makeMessageId(prefix = "message") {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function decodeChatResponse(payload) {
  if (!payload || typeof payload !== "object") throw new Error("Invalid chat response");
  if (typeof payload.reply !== "string" || !payload.reply.trim()) throw new Error("Invalid chat reply");
  if (typeof payload.conversationId !== "string" || !UUID.test(payload.conversationId)) throw new Error("Invalid conversation");

  const status = payload.safety?.status;
  const validStatuses = new Set(["allowed", "blocked", "emergency", "redirected", "sanitized"]);
  if (!validStatuses.has(status)) throw new Error("Invalid safety status");

  const sources = status === "allowed" && Array.isArray(payload.sources)
    ? payload.sources.filter((source) => {
        if (!source || typeof source.name !== "string" || !source.name.trim() || source.name.length > 300 ||
          typeof source.url !== "string" || source.url.length > 2048) return false;
        try {
          const url = new URL(source.url);
          return url.protocol === "https:" && !url.username && !url.password;
        } catch { return false; }
      })
    : [];

  return {
    reply: payload.reply.trim(),
    conversationId: payload.conversationId,
    sources,
    safety: status,
    ...(payload.persona ? { persona: parsePublicPersona(payload.persona) } : {}),
    ...(status === "allowed" && ["museum_artifact_web_match", "museum_artifact_match", "museum_attachment_clarification", "museum_attachment_unavailable", "museum_generated", "museum_clarification", "museum_fallback", "attachment_answer", "attachment_clarification", "attachment_unavailable", "persona_identity", "curated_evidence", "evidence_composition", "curated_faq", "curated_faq_fallback", "generated_answer", "generated_general", "knowledge_clarification", "weather_current", "weather_forecast", "weather_clarification", "weather_unavailable"].includes(payload.ai?.mode)
      ? { ai: { mode: payload.ai.mode } } : {}),
    ...(status === "allowed" && payload.faq && /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/.test(payload.faq.id) &&
      typeof payload.faq.question === "string" && payload.faq.question.length <= 500 && typeof payload.faq.category === "string"
      ? { faq: { id: payload.faq.id, question: payload.faq.question, category: payload.faq.category } } : {})
  };
}

export function parseChatResponse(payload) {
  try { return decodeChatResponse(payload); }
  catch {
    const failure = new Error("Invalid chat response");
    failure.code = "invalid_response";
    throw failure;
  }
}

export function chatErrorMessage(status, language = "en", serverMessage = "", code = "") {
  const languageCopy = COPY[language] || COPY.en;
  if (status === 401) return languageCopy[401];
  if (["conversation_create", "invalid_response"].includes(code)) return languageCopy[code];
  if (status && languageCopy[status]) return languageCopy[status];
  if (typeof serverMessage === "string" && serverMessage.trim() && status < 500) return serverMessage.trim();
  return languageCopy.offline;
}

export function buildChatBody({ message, conversationId, language, personaId }) {
  if (personaId !== undefined && !isPersonaId(personaId)) throw new Error("Invalid assistant profile.");
  return {
    conversationId: conversationId || null,
    message: String(message).trim(),
    language: language === "zh" ? "zh" : "en",
    ...(personaId ? { personaId } : {})
  };
}
