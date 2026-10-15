export function isItineraryRequest(message) {
  return /\b(itinerary|day trip|travel plan|plan a|plan my|schedule my)\b|行程|路线|一日游|旅游计划|旅行计划/i.test(message);
}

export const ITINERARY_INSTRUCTIONS = [
  "If an itinerary is requested, give an ordered and realistic suggestion.",
  "Ask for missing duration, starting point or accessibility needs when essential.",
  "Use only the supplied verified attractions as factual location references.",
  "Do not invent current ticket prices, operating hours, reservations or exact travel times.",
  "Label time blocks as suggestions, not verified venue operating times.",
  "Do not claim route optimization without a routing API."
].join(" ");
