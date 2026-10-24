// Conservative offline fallback, NOT an AI model. Live semantic selection lives
// in ai/provider.js. Neither path generates answers outside the stored bank.
export function tourismOnlyReply(language = "en") {
  return language === "zh"
    ? "请只询问与中国旅游相关的问题。我未能在这份 100 题问答库中找到可靠匹配。你可以问签证准备、交通、支付、餐饮或景点游览等问题。"
    : "Please ask questions related only to tourism in China. I couldn't reliably match your question to the 100-question FAQ bank. You can ask about entry preparation, transport, payments, food or sightseeing.";
}

export function normalizeQuestion(value) {
  return String(value).normalize("NFKC").toLowerCase().replace(/[’']/g, "").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

// Narrow, human-reviewed paraphrases shared by retrieval and offline matching.
// Do not turn a shared place name into a match for arbitrary appended requests.
function introductoryFaqId(normalized) {
  return /^(?:介绍西湖|请介绍西湖|介绍一下西湖)$/.test(normalized) ? "CN061" : null;
}

const culturalFollowup = /^(?:what is its cultural significance|why is it culturally significant|what is its significance|它有什么文化意义|它的文化意义是什么)$/;
function contextualFaqId(text, history) {
  if (!culturalFollowup.test(text)) return undefined;
  const previous = history.slice().reverse().find(m => m.role === "user" && typeof m.content === "string");
  // A pronoun without an unambiguous supported referent is not evidence of a
  // match. Never let generic cultural bigrams replace missing safe context.
  return previous && /west lake|西湖/i.test(previous.content) && !/grand canal|大运河/i.test(previous.content) ? "CN061" : null;
}
const unsupportedPremise = /\b(?:fictional|nonexistent|imaginary)\s+(?:[a-z]+\s+){0,8}(?:museum|palace|attraction)\b|(?:不存在|虚构|虛構).{0,35}(?:博物馆|博物館|宫|宮|景点|景點)/i;

const stop = new Set(("a an the how what which when where why who do does did can could should would will i we my our me us you your to of for in on at is are it its this that as and or about please tell recommend some any china chinese travel traveling travelling trip visit visiting tourist tourists tourism need use get with from have has be by before while during not only" ).split(" "));
function tokens(value) {
  const normalized = normalizeQuestion(value);
  const english = normalized.match(/[a-z0-9]+/g) || [];
  const han = normalized.match(/\p{Script=Han}+/gu) || [];
  return new Set([
    ...english.map((w) => w.length > 4 ? w.replace(/(?:ing|ies|s)$/, (s) => s === "ies" ? "y" : "") : w).filter((w) => !stop.has(w)),
    ...han.flatMap((run) => run.length === 1 ? [run] : Array.from({ length: run.length - 1 }, (_, i) => run.slice(i, i + 2)))
  ]);
}

const unrelated = /\b(?:code|programming|javascript|python|football|stock|bitcoin|crypto|recipe|homework|president|election|poem|joke|horoscope|capital of|weather in (?:london|paris|tokyo)|japan|korea|thailand|singapore|france|italy|australia)\b|(?:编程|代码|股票|比特币|足球|作业|笑话|诗歌|日本|韩国|泰国|新加坡|法国|澳大利亚)/i;

export function matchFaqOffline(message, bank, history = [], { allowReviewedTopics = false } = {}) {
  const text = normalizeQuestion(message);
  if (allowReviewedTopics) {
    const exact = bank.find(faq => [faq.question_en, faq.question_zh, ...(faq.aliases || [])].some(question => normalizeQuestion(question) === text));
    if (exact) return { faqId: exact.id, confidence: 1 };
  }
  if (unrelated.test(text) || unsupportedPremise.test(text)) return null;
  const introductoryId = introductoryFaqId(text);
  if (introductoryId && bank.some(faq => faq.id === introductoryId)) return { faqId: introductoryId, confidence: 1 };
  const documents = bank.map((faq) => ({ faq, variants: [faq.question_en, faq.question_zh, ...faq.aliases] }));
  const exact = documents.find((doc) => doc.variants.some((q) => normalizeQuestion(q) === text));
  if (exact) return { faqId: exact.faq.id, confidence: 1 };
  const contextualId = contextualFaqId(text, history);
  if (contextualId !== undefined) return contextualId && bank.some(faq => faq.id === contextualId) ? { faqId: contextualId, confidence: 0.9 } : null;
  const query = tokens(message);
  if (!query.size) return null;
  const frequency = new Map();
  for (const doc of documents) for (const token of new Set(doc.variants.flatMap((v) => [...tokens(v)]))) frequency.set(token, (frequency.get(token) || 0) + 1);
  const weight = (token) => Math.log(1 + bank.length / (1 + (frequency.get(token) || 0)));
  const ranked = documents.map(({ faq, variants }) => {
    let score = 0;
    for (const variant of variants) {
      const candidate = tokens(variant);
      const common = [...query].filter((token) => candidate.has(token));
      if (!common.length) continue;
      const intersection = common.reduce((sum, token) => sum + weight(token), 0);
      const qWeight = [...query].reduce((sum, token) => sum + weight(token), 0);
      const cWeight = [...candidate].reduce((sum, token) => sum + weight(token), 0);
      const coverage = intersection / qWeight;
      const dice = 2 * intersection / (qWeight + cWeight);
      if (coverage >= 0.67 && (common.length >= 2 || query.size === 1 && candidate.size === 1)) score = Math.max(score, 0.6 * coverage + 0.4 * dice);
    }
    return { faqId: faq.id, confidence: score };
  }).sort((a, b) => b.confidence - a.confidence);
  if (!ranked.length || ranked[0].confidence < 0.77 || ranked[0].confidence - (ranked[1]?.confidence || 0) < 0.09) return null;
  return ranked[0];
}

// Narrow the model's prompt to plausible FAQs instead of transmitting the full bank.
// Relevance ranking is only a retrieval stage: the model still selects a known ID.
export function shortlistFaqs(message, bank, history = [], limit = 12, { allowReviewedTopics = false } = {}) {
  const normalized = normalizeQuestion(message);
  if (allowReviewedTopics) {
    const exact = bank.find(faq => [faq.question_en, faq.question_zh, ...(faq.aliases || [])].some(question => normalizeQuestion(question) === normalized));
    if (exact) return [exact];
  }
  if (!normalized || unrelated.test(normalized) || unsupportedPremise.test(normalized)) return [];
  const introductoryId = introductoryFaqId(normalized);
  if (introductoryId) return bank.filter(faq => faq.id === introductoryId);
  const exact = bank.find((faq) => [faq.question_en, faq.question_zh, ...faq.aliases]
    .some((variant) => normalizeQuestion(variant) === normalized));
  if (exact) return [exact];
  const contextualId = contextualFaqId(normalized, history);
  if (contextualId !== undefined) return contextualId ? bank.filter(faq => faq.id === contextualId) : [];
  const query = tokens(message);
  if (!query.size) return [];
  const results = bank.map((faq) => {
    const variants = [faq.question_en, faq.question_zh, ...faq.aliases];
    const score = Math.max(...variants.map((variant) => {
      const candidate = tokens(variant);
      const shared = [...query].filter((word) => candidate.has(word));
      if (!shared.length) return 0;
      return shared.length / Math.sqrt(query.size * Math.max(candidate.size, 1));
    }));
    return { faq, score };
  }).filter(({score}) => score > 0).sort((a,b) => b.score - a.score);
  return results.slice(0, Math.max(1, Math.min(12, limit))).map(({faq}) => faq);
}
