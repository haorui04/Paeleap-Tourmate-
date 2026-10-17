import { attractions } from "../../data/attractions.js";

function normalize(value) {
  return String(value).normalize("NFKC").toLowerCase();
}

export function retrieveAttractions(message, limit = 4) {
  const query = normalize(message);
  const words = query.match(/[a-z]{3,}|[\u3400-\u9fff]{1,}/g) ?? [];
  const ranked = attractions.map((item) => {
    const english = normalize(item.name_en);
    const chinese = normalize(item.name_zh);
    const haystack = normalize([item.city, item.name_en, item.name_zh, ...item.keywords].join(" "));
    let score = query.includes(english) || query.includes(chinese) ? 8 : 0;
    for (const word of words) if (haystack.includes(word)) score += 2;
    if (/hangzhou|杭州/.test(query)) score += 1;
    return { item, score };
  }).filter(({ score }) => score > 0);
  return ranked.sort((a, b) => b.score - a.score).slice(0, limit).map(({ item }) => item);
}

export function makeKnowledgeContext(items, language) {
  if (!items.length) return "No verified attraction records match this question.";
  return items.map((i) => [
    "Attraction: " + i.name_en + " (" + i.name_zh + ")",
    "City: " + i.city,
    "Description: " + (language === "zh" ? i.description_zh : i.description_en),
    "Source: " + i.source_url
  ].join("\n")).join("\n\n");
}

export function sourceLinks(items) {
  return items.map(i => ({ name: i.name_en, url: i.source_url }));
}
