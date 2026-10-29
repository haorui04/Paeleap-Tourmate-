// Bounded normalization is a detection aid, not a decoder/executor or a claim
// that every encoding, language or adversarial intent can be recognized.
export function normalizeForSafety(value) {
  const folded = String(value).slice(0, 1500).normalize("NFKC")
    .replace(/[\p{Cf}\u034f\u180e]/gu, "").toLowerCase();
  const lookalikes = { "а": "a", "е": "e", "о": "o", "р": "p", "с": "c", "у": "y", "х": "x", "і": "i", "ј": "j", "ӏ": "l" };
  const text = folded.replace(/[аеорсухіјӏ]/gu, (letter) => lookalikes[letter] || letter)
    .replace(/<\/?(?:span|b|i|p|div|em|strong|a)(?:\s[^>]{0,100})?>/g, " ");
  const decoded = [];
  // Only explicit, recognizable wrappers are inspected. Never recurse or fetch
  // URLs. Each decoded fragment is capped at the ordinary message limit.
  if (/percent[- ]?encod|url[- ]?encod|decode|解码|解碼/.test(text) && /%[0-9a-f]{2}/i.test(text)) {
    try { decoded.push(decodeURIComponent(text).slice(0, 1500)); } catch { /* malformed => no decoded view */ }
  }
  if (/unicode|escape|转义|轉義|decode|解码|解碼/.test(text) && /\\u[0-9a-f]{4}/i.test(text)) {
    decoded.push(text.replace(/\\u([0-9a-f]{4})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16))).slice(0, 1500));
  }
  if (/base64|b64|解码|解碼/.test(text)) {
    // Use the original case-sensitive payload: lowercasing corrupts Base64.
    for (const token of String(value).match(/[A-Za-z0-9+/]{16,}={0,2}/g) || []) {
      if (token.length > 2048 || token.length % 4 === 1) continue;
      try {
        const content = Buffer.from(token, "base64").toString("utf8");
        if (!content.includes("\ufffd") && /[a-z\p{Script=Han}]/iu.test(content)) decoded.push(content.slice(0, 1500));
      } catch { /* inspection is best effort */ }
      if (decoded.length >= 3) break;
    }
  }
  let compactCommands = text;
  for (const word of ["reveal", "your", "api", "key", "system", "prompt"]) {
    compactCommands = compactCommands.replace(new RegExp("\\b" + [...word].join("[\\s_.-]*") + "\\b", "g"), word);
  }
  compactCommands = compactCommands.replace(/([\p{Script=Han}])\s+(?=[\p{Script=Han}])/gu, "$1");
  return [text, compactCommands.replace(/\s+/g, " "), ...decoded.map((item) => item.normalize("NFKC").replace(/\p{Cf}/gu, "").toLowerCase())].join("\n").slice(0, 6000);
}

export function redactSensitiveText(value, { maxCharacters = 1500 } = {}) {
  const limit = Number.isSafeInteger(maxCharacters) && maxCharacters >= 1 && maxCharacters <= 12000 ? maxCharacters : 1500;
  return String(value).slice(0, limit)
    .replace(/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[\s\S]*/gi, "[REDACTED_PRIVATE_KEY]")
    .replace(/\b(?:sk-[A-Za-z0-9_-]{12,}|sb_secret_[A-Za-z0-9_-]+|gh[pousr]_[A-Za-z0-9_]{12,}|github_pat_[A-Za-z0-9_]{12,}|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)\b/g, "[REDACTED_SECRET]")
    .replace(/\bBearer\s+[^\s,;"']+/gi, "Bearer [REDACTED_SECRET]")
    .replace(/((?:api[ _-]?key|password|passwd|secret|access[ _-]?token|refresh[ _-]?token|service[ _-]?role[ _-]?key|密码|密碼|密钥|密鑰)\s*[:=：]\s*)[^\s,;"']+/gi, "$1[REDACTED_SECRET]")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[REDACTED_EMAIL]")
    .replace(/[A-Z0-9._%+-]+\s*(?:\(at\)|\[at\])\s*[A-Z0-9.-]+(?:\s*(?:\(dot\)|\[dot\])\s*[A-Z0-9-]+)+/gi, "[REDACTED_EMAIL]")
    // Redact self-disclosed home addresses, not every public attraction address.
    // This remains a bounded minimisation aid, not comprehensive PII detection.
    .replace(/((?:i (?:live|reside) at|my (?:home|street|mailing|postal) address (?:is|:)|home address\s*[:=])\s*)\d{1,6}\s+[A-Z0-9 .'-]{1,90}\b(?:street|st\.?|road|rd\.?|avenue|ave\.?|lane|ln\.?|drive|dr\.?|way|court|ct\.?)\b(?:,\s*[A-Z][A-Z '-]{1,40})?/gi, "$1[REDACTED_ADDRESS]")
    .replace(/((?:我的(?:家庭|居住|邮寄|郵寄)?地址是?|我住在)\s*[:：]?\s*)[^。！？\n]{0,70}(?:路|街|巷)\s*\d{1,6}号(?:[^。！？\n]{0,25}(?:室|楼|樓))?/g, "$1[REDACTED_ADDRESS]")
    .replace(/((?:passport|护照|護照)(?:\s*(?:number|no\.?|号码|號碼))?\s*[:=#：]?\s*)(?:[A-Z]\s*){0,3}\d[A-Z0-9 -]{5,15}\b/gi, "$1[REDACTED_DOCUMENT]")
    .replace(/\b\d{17}[\dXx]\b/g, "[REDACTED_DOCUMENT]")
    .replace(/\b(?:\d[ -]?){13,19}\b/g, "[REDACTED_NUMBER]")
    .replace(/(?:\+?86[ .-]?)?\b1[3-9]\d[ .-]?\d{4}[ .-]?\d{4}\b/g, "[REDACTED_PHONE]")
    .replace(/\+\d[\d ().-]{6,24}\d\b/g, "[REDACTED_PHONE]")
    .replace(/((?:phone|mobile|telephone|电话|電話|手机号|手機號)\s*(?:is\s*)?[:=：]?\s*)\+?[\d][\d ().-]{6,20}\d/gi, "$1[REDACTED_PHONE]");
}
