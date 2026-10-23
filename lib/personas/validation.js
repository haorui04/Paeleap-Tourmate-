import { isIP } from "node:net";

export const MAX_PERSONA_BYTES = 2 * 1024 * 1024;
// Uploads remain capped at 2 MiB. jsonb::text/PostgREST add formatting space;
// reserve a separate bounded 0.5 MiB for that internal serialization overhead.
export const MAX_STORED_PERSONA_BYTES = MAX_PERSONA_BYTES + 512 * 1024;
export const PERSONA_ID_PATTERN = /^[a-z][a-z0-9-]{1,63}$/;
export const MAX_KNOWLEDGE_RECORDS = 2000;

export class PersonaError extends Error {
  constructor(message, status = 400, code = "invalid_persona") {
    super(message);
    this.name = "PersonaError";
    this.status = status;
    this.code = code;
  }
}

const dangerousInstructions = /ignore\s+(?:all\s+|the\s+)?(?:previous|prior|system|safety)\s+(?:instructions?|rules?|polic(?:y|ies))|(?:reveal|print|expose|leak)\s+(?:the\s+|your\s+)?(?:system\s+prompt|api\s+keys?|credentials?|secrets?)|(?:disable|bypass|override)\s+(?:all\s+|the\s+)?(?:safety|security|guardrails?|restrictions?)|忽略.{0,8}(?:之前|系统|安全).{0,8}(?:指令|规则)|(?:泄露|输出|显示).{0,6}(?:系统提示词|密钥|凭据)|(?:关闭|绕过|禁用).{0,6}(?:安全|限制|护栏)/iu;
const secretPattern = /\b(?:sk-[A-Za-z0-9_-]{16,}|sb_secret_[A-Za-z0-9_-]{10,}|gh[pousr]_[A-Za-z0-9_]{12,}|github_pat_[A-Za-z0-9_]{12,}|eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)\b|-----BEGIN [A-Z ]*PRIVATE KEY-----|\bBearer\s+[A-Za-z0-9_./+-]{12,}|\b(?:api[_ -]?key|access[_ -]?token|refresh[_ -]?token|password|secret)\s*[:=]\s*["']?[A-Za-z0-9_./+-]{12,}/iu;

// Narrow supply-chain tripwires for explicit operational assistance. They do
// not infer intent or prove arbitrary curator-uploaded prose is safe. In
// particular, defensive "how to avoid theft" / "never steal" remains valid.
const operationalHarm = [
  /(?:^|[.!?\n]\s*)(?:here(?:'s| is| are)\s+)?(?:how to|steps to|instructions (?:for|to)|a guide to)\s+(?:steal|pickpocket|rob|kidnap|poison|kill|murder|smuggle|bribe|forge|counterfeit|stalk|blackmail|launder)\b/iu,
  /(?:^|[.!?\n]\s*)(?:step\s+\d+\s*[:.)-]\s*|first,?\s+)(?:steal|pickpocket|rob|kidnap|poison|kill|murder|smuggle|bribe|forge|counterfeit|stalk|blackmail|launder)\b/iu,
  /(?:^|[。！？\n]\s*)(?:(?:以下|下面)(?:是)?(?:具体|具體)?(?:步骤|步驟)?[：:]?\s*)?(?:如何|怎样|怎樣|第一步[：:]?)\s*(?:盗窃|盜竊|偷窃|偷竊|偷走|抢劫|搶劫|绑架|綁架|投毒|杀人|殺人|走私|行贿|行賄|伪造|偽造|洗钱|洗錢)/u
];

function object(value, keys, label) {
  if (!value || typeof value !== "object" || Array.isArray(value) ||
      Object.getPrototypeOf(value) !== Object.prototype ||
      Object.keys(value).some((key) => !keys.includes(key))) {
    throw new PersonaError(`${label} must contain only the documented fields`);
  }
}

function text(value, max, label) {
  if (typeof value !== "string" || !value.trim() || value.length > max ||
      /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\p{Cf}]/u.test(value)) {
    throw new PersonaError(`Invalid ${label}`);
  }
  const normalized = value.normalize("NFKC").trim();
  if (normalized.length > max) throw new PersonaError(`Invalid ${label}`);
  if (dangerousInstructions.test(normalized) || secretPattern.test(normalized)) {
    throw new PersonaError(`${label} contains prohibited instructions or possible credentials`);
  }
  // Inspect a compatibility-folded view, but preserve curator-approved display
  // punctuation and wording (notably Chinese full-width commas and colons).
  return value.trim();
}

function bilingual(value, max, label) {
  object(value, ["en", "zh"], label);
  return { en: text(value.en, max, `${label}.en`), zh: text(value.zh, max, `${label}.zh`) };
}

export function validateReferenceUrl(value) {
  if (typeof value !== "string" || value.length > 2048 || /[\u0000-\u0020\u007F]/u.test(value)) {
    throw new PersonaError("Invalid reference URL");
  }
  let url;
  try { url = new URL(value); } catch { throw new PersonaError("Invalid reference URL"); }
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443") ||
      isIP(host.replace(/^\[|\]$/g, "")) || host.includes(":") ||
      !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(host) ||
      /(?:^|\.)(?:localhost|local|internal|lan|home|test|invalid|example|onion)$/i.test(host) ||
      /(?:^|\.)(?:nip\.io|sslip\.io|localtest\.me)$/i.test(host) ||
      [...url.searchParams.keys()].some((key) => /(?:token|secret|password|api.?key|credential)/i.test(key))) {
    throw new PersonaError("References must be public HTTPS URLs without credentials or local addresses");
  }
  // References are displayed, never fetched or executed by the importer.
  return url.href;
}

function freeze(value) {
  if (value && typeof value === "object") {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

export function validatePersonaPackage(input, { allowEmptyKnowledge = false } = {}) {
  object(input, ["id", "version", "name", "venue", "role", "tone", "greeting", "scope", "knowledge"], "Persona package");
  if (Buffer.byteLength(JSON.stringify(input), "utf8") > MAX_PERSONA_BYTES) {
    throw new PersonaError("Persona package exceeds 2 MB", 413, "persona_too_large");
  }
  if (typeof input.id !== "string" || !PERSONA_ID_PATTERN.test(input.id) ||
      !Number.isSafeInteger(input.version) || input.version < 1 || input.version > 2147483647) {
    throw new PersonaError("Invalid persona ID or version");
  }
  if (!["professional", "warm", "child_friendly"].includes(input.tone)) throw new PersonaError("Invalid persona tone");
  if (!Array.isArray(input.scope) || input.scope.length < 1 || input.scope.length > 20) throw new PersonaError("Persona scope must contain 1–20 topics");
  if (!Array.isArray(input.knowledge) || input.knowledge.length > MAX_KNOWLEDGE_RECORDS ||
      (!allowEmptyKnowledge && input.knowledge.length === 0)) throw new PersonaError("Knowledge must contain 1–2000 records");
  const ids = new Set();
  const questions = new Set();
  const knowledge = input.knowledge.map((row) => {
    object(row, ["id", "question_en", "question_zh", "answer_en", "answer_zh", "sources"], "Knowledge record");
    if (typeof row.id !== "string" || !/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(row.id) || ids.has(row.id)) {
      throw new PersonaError("Knowledge IDs must be unique alphanumeric identifiers");
    }
    ids.add(row.id);
    const record = { id: row.id };
    for (const field of ["question_en", "question_zh", "answer_en", "answer_zh"]) {
      record[field] = text(row[field], field.startsWith("question") ? 500 : 1600, `Knowledge ${field}`);
      if (field.startsWith("answer") && operationalHarm.some((rule) => rule.test(record[field]))) {
        throw new PersonaError("Knowledge answer contains prohibited operational instructions");
      }
      if (field.startsWith("question")) {
        const signature = `${field}:${record[field].toLocaleLowerCase()}`;
        if (questions.has(signature)) throw new PersonaError("Duplicate knowledge question");
        questions.add(signature);
      }
    }
    if (!Array.isArray(row.sources) || row.sources.length > 6) throw new PersonaError("Knowledge sources must contain at most 6 references");
    record.sources = row.sources.map((source) => {
      object(source, ["name", "url"], "Knowledge source");
      return { name: text(source.name, 160, "Source name"), url: validateReferenceUrl(source.url) };
    });
    return record;
  });
  const profile = { id: input.id, version: input.version, name: bilingual(input.name, 80, "Persona name"),
    venue: bilingual(input.venue, 160, "Venue"), role: bilingual(input.role, 1600, "Role description"),
    tone: input.tone, greeting: bilingual(input.greeting, 800, "Greeting"),
    scope: input.scope.map((topic) => text(topic, 200, "Scope topic")), knowledge };
  if (Buffer.byteLength(JSON.stringify(profile), "utf8") > MAX_PERSONA_BYTES) {
    throw new PersonaError("Normalized persona package exceeds 2 MB", 413, "persona_too_large");
  }
  return freeze(profile);
}

export function publicPersona(profile) {
  const { id, version, name, venue, greeting, tone } = profile;
  return { id, version, name, venue, greeting, tone };
}

export function personaKnowledge(profile) {
  return profile.knowledge.map((record) => ({ ...record, category: "museum", aliases: [] }));
}
