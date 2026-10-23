// Reviewed, bounded multi-topic planning support for the default TourMate bank.
// No generated facts, bookings, live data or custom-museum/global-bank mixing.
export function reviewedPlanningRecords(message, bank) {
  const text = String(message).normalize("NFKC").toLowerCase();
  if (!/\b(?:china|hangzhou|chinese)\b|中国|中國|杭州/.test(text) ||
      !/\b(?:combine|combining|synthesi[sz]e)\b|综合|綜合/.test(text) ||
      /\b(?:not|don't|do not|without|instead|rather than|except)\b|不要|不想|不需要|并非|並非|而不是|除外/.test(text)) return [];
  const ids = [];
  const add = (condition, id) => { if (condition) ids.push(id); };
  add(/\bhangzhou\b|杭州/.test(text) && /relax|gentle|slow|轻松|輕鬆|休闲|休閒/.test(text), "CN062");
  add(/\b(?:payments?|paying)\b|支付|付款/.test(text), "CN014");
  add(/\ballerg(?:y|ies|ic)\b|过敏|過敏/.test(text), "CN054");
  add(/accessib|wheelchair|无障碍|無障礙/.test(text), "CN086");
  add(/\b(?:older|elderly|slow|rest|pace)\b|行动速度|行動速度|节奏|節奏|老人|长者|長者/.test(text), "CN087");
  add(/\bfirst (?:trip|time)\b|第一次/.test(text), "CN001");
  if (ids.length < 2) return [];
  const selected = [...new Set(ids)].slice(0, 3).map(id => bank.find(row => row.id === id));
  return selected.every(Boolean) ? selected : [];
}
