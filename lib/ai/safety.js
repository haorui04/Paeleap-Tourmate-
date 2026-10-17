import { tourismOnlyReply } from "../tourism/faq-matching.js";

/**
 * Deterministic safety layer for a tourism-only pilot.
 * These rules are a first defence, not a comprehensive content-moderation system.
 */
const normalize = value => String(value).normalize("NFKC").toLowerCase();

const injection = [
  /ignore\s+(?:all\s+)?(?:previous|earlier|above|system|developer)\s+(?:instructions|rules|prompts?)/i,
  /(?:reveal|show|print|leak|expose)\s+(?:your\s+)?(?:system|developer|hidden)\s+(?:instructions|prompts?)/i,
  /(?:reveal|show|print|leak|expose)\s+(?:your\s+)?(?:api\s*key|secret|credentials?)/i,
  /忽略.{0,14}(?:指令|规则|提示词)|泄露.{0,14}(?:密钥|提示词)|显示.{0,14}系统提示/i
];
const restricted = [
  /(?:bypass|enter|cross|climb|sneak).{0,45}(?:closed|restricted|barrier|fence|no.entry)/i,
  /(?:closed|restricted).{0,45}(?:trail|path|area).{0,25}(?:enter|access|cross)/i,
  /(?:翻越|闯入|绕过).{0,20}(?:封闭|围栏|禁区)|(?:禁区|封闭区域).{0,15}(?:怎么进入|如何进入)/i
];
const emergencies = [
  /\b(?:unconscious|unresponsive|severe bleeding|heart attack|chest pain|cannot breathe|difficulty breathing|serious injury|head injury|heat stroke)\b/i,
  /(?:失去意识|昏迷|大量出血|呼吸困难|胸痛|严重受伤|中暑)/i
];
const outsideScope = [
  /\b(?:write|generate|create|debug|implement)\b.{0,45}\b(?:malware|virus|python code|javascript code|program|script)\b/i,
  /(?:编写|生成).{0,30}(?:代码|恶意软件|病毒)/i
];

function messageFor(status, lang) {
  const zh = lang === "zh";
  const texts = {
    emergency: zh
      ? "这可能是紧急情况。请立即联系当地急救服务，远离危险区域，并向附近工作人员寻求帮助。不要仅依靠聊天机器人处理紧急情况。"
      : "This may be an emergency. Contact local emergency services now, move away from danger if safe, and ask nearby staff for help. Do not rely on a chatbot for urgent assistance.",
    blocked: zh
      ? "我不能帮助绕过安全限制，也不能提供私人密钥或隐藏指令。请遵守景区规定；我可以建议安全的游览方式。"
      : "I can't help bypass safety restrictions or reveal private credentials or hidden instructions. Please follow site rules; I can suggest safer visitor options.",
    redirected: tourismOnlyReply(lang)
  };
  return texts[status];
}

export function classifyInput(message, language = "en") {
  if (typeof message !== "string" || !message.trim() || message.length > 1500) {
    return { status: "invalid", reply: null };
  }
  const text = normalize(message);
  if (emergencies.some(rule => rule.test(text))) return { status: "emergency", reply: messageFor("emergency", language) };
  if ([...injection, ...restricted].some(rule => rule.test(text))) {
    return { status: "blocked", reply: messageFor("blocked", language) };
  }
  if (outsideScope.some(rule => rule.test(text))) return { status: "redirected", reply: messageFor("redirected", language) };
  return { status: "allowed", reply: null };
}

export function validateOutput(reply, language = "en") {
  const fallback = language === "zh"
    ? "我无法可靠地验证这条回复中的部分信息。请通过景区官方渠道确认票价、开放时间及交通安排。"
    : "I couldn't reliably verify part of that answer. Please check official attraction sources for prices, opening hours, or transport arrangements.";
  if (typeof reply !== "string" || !reply.trim()) {
    return { reply: fallback, status: "sanitized" };
  }
  const secretLike = /(?:sk-[A-Za-z0-9_-]{16,}|sb_secret_[A-Za-z0-9_-]+|-----BEGIN (?:RSA |EC )?PRIVATE KEY-----)/;
  const dynamicClaim = /\b(?:tickets?|admission|entry fee|opens?|closes?|last entry|train departs?|bus departs?)\b.{0,60}(?:\d{1,2}:\d{2}|\d+\s*(?:rmb|cny|yuan))|(?:票价|门票|开放时间|关门时间|发车时间).{0,30}(?:\d+元|\d{1,2}[:：]\d{2})/i;
  if (secretLike.test(reply) || dynamicClaim.test(reply)) return { reply: fallback, status: "sanitized" };
  return { reply: reply.trim(), status: "allowed" };
}
