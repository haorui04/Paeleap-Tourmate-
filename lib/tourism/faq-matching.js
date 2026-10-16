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

export function matchFaqOffline(message, bank, history = []) {
  const text = normalizeQuestion(message);
  if (unrelated.test(text)) return null;
  const documents = bank.map((faq) => ({ faq, variants: [faq.question_en, faq.question_zh, ...faq.aliases] }));
  const exact = documents.find((doc) => doc.variants.some((q) => normalizeQuestion(q) === text));
  if (exact) return { faqId: exact.faq.id, confidence: 1 };
  if (/^(?:what is its cultural significance|why is it culturally significant|它有什么文化意义|它的文化意义是什么)$/.test(text)) {
    const previous = history.slice().reverse().find((m) => m.role === "user" && typeof m.content === "string");
    if (previous && /west lake|西湖/i.test(previous.content) && !/grand canal|大运河/i.test(previous.content)) return { faqId: "CN061", confidence: 0.9 };
  }
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
  if (ranked[0].confidence < 0.77 || ranked[0].confidence - ranked[1].confidence < 0.09) return null;
  return ranked[0];
}
