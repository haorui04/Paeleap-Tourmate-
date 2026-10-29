export const DEFAULT_PERSONA_ID = "tourmate";
// Preserve the legacy travel profile and its saved chats under an explicit link.
export const ENTRY_PERSONA_ID = "little-de-rabbit";
export const MAX_PERSONA_FILE_BYTES = 2 * 1024 * 1024;
export const isPersonaId = (value) => typeof value === "string" && /^[a-z][a-z0-9-]{1,63}$/.test(value);

export function personaIdFromSearch(search = "") {
  const requested = new URLSearchParams(search).get("persona");
  if (requested === null) return ENTRY_PERSONA_ID;
  if (!isPersonaId(requested)) throw new Error("Invalid assistant profile link.");
  return requested;
}

function bilingual(value, maximum) {
  if (!value || typeof value !== "object" || !["en", "zh"].every((language) =>
    typeof value[language] === "string" && value[language].trim() && value[language].length <= maximum)) {
    throw new Error("Invalid assistant profile.");
  }
  return { en: value.en, zh: value.zh };
}

// Public identity is data, never executable markup or a visitor-supplied prompt.
export function parsePublicPersona(value) {
  if (!value || !isPersonaId(value.id) || !["string", "number"].includes(typeof value.version) ||
    !/^[1-9]\d{0,9}$/.test(String(value.version)) || !Number.isSafeInteger(Number(value.version)) ||
    Number(value.version) > 2147483647) throw new Error("Invalid assistant profile.");
  return {
    id: value.id,
    // Preserve the integer contract required by conversation inserts and the
    // server's immutable persona binding. Old cached numeric strings are valid.
    version: Number(value.version),
    name: bilingual(value.name, 100),
    venue: bilingual(value.venue, 160),
    greeting: bilingual(value.greeting, 1000),
    ...(typeof value.tone === "string" && value.tone.length <= 500 ? { tone: value.tone } : {})
  };
}

export function provenanceLabel(mode, language = "en") {
  const labels = language === "zh" ? {
    attachment_answer: "AI 解读 · 用户提供的附件",
    attachment_clarification: "需要更清晰的旅游资料",
    attachment_unavailable: "附件功能未启用",
    weather_current: "最新天气 · Open-Meteo",
    weather_forecast: "天气预报 · Open-Meteo",
    weather_clarification: "需要补充天气查询信息",
    weather_unavailable: "天气数据暂不可用",
    persona_identity: "角色设定",
    museum_generated: "AI 讲解 · 博物馆参考资料",
    museum_artifact_match: "文物候选匹配 · 请核对展签",
    museum_attachment_clarification: "需要补充文物或展签信息",
    museum_attachment_unavailable: "文物识别暂不可用",
    museum_clarification: "需要补充展品信息",
    museum_fallback: "服务降级 · 已发布博物馆资料",
    curated_evidence: "已发布资料",
    evidence_composition: "依据馆方资料组合回答",
    generated_answer: "AI生成 · 参考知识库",
    generated_general: "AI生成 · 一般旅游建议",
    knowledge_clarification: "需要补充旅游信息",
    curated_faq: "知识库原文答复",
    curated_faq_fallback: "服务降级：知识库答复"
  } : {
    attachment_answer: "AI interpretation · your attachment",
    attachment_clarification: "Clearer travel evidence needed",
    attachment_unavailable: "Attachments unavailable",
    weather_current: "Current weather · Open-Meteo",
    weather_forecast: "Weather forecast · Open-Meteo",
    weather_clarification: "Weather details needed",
    weather_unavailable: "Weather data unavailable",
    persona_identity: "Published persona",
    museum_generated: "AI explanation · museum references",
    museum_artifact_match: "Suggested artifact match · check the label",
    museum_attachment_clarification: "Artifact or label details needed",
    museum_attachment_unavailable: "Artifact recognition unavailable",
    museum_clarification: "Exhibit details needed",
    museum_fallback: "Fallback · published museum references",
    curated_evidence: "Approved knowledge",
    evidence_composition: "Composed from venue references",
    generated_answer: "AI-generated · knowledge references",
    generated_general: "AI-generated · general travel guidance",
    knowledge_clarification: "Travel details needed",
    curated_faq: "Knowledge-bank answer",
    curated_faq_fallback: "Fallback: knowledge-bank answer"
  };
  return labels[mode] || "";
}

// Preview is only a convenience. The authenticated server independently validates
// every field, permission, knowledge record, and revision before publishing.
export async function readPersonaPackage(file) {
  if (!file || typeof file.size !== "number" || file.size <= 0 || file.size > MAX_PERSONA_FILE_BYTES) {
    throw new Error("Choose a non-empty JSON package no larger than 2 MB.");
  }
  if (!/\.json$/i.test(file.name || "")) throw new Error("Choose a .json persona package.");
  let payload;
  try { payload = JSON.parse(await file.text()); } catch { throw new Error("The file is not valid JSON."); }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("Invalid persona package.");
  const persona = parsePublicPersona(payload);
  const records = payload.knowledge;
  if (!Array.isArray(records) || !records.length) throw new Error("The package must include knowledge records.");
  return { payload, persona, recordCount: records.length };
}
