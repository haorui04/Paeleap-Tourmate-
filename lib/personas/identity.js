// Public identity comes from administrator-owned data, never from retrieval or
// a model's default provider identity. Match the whole question so appended
// role-change or data-extraction requests cannot inherit this response path.
export function isPersonaIdentityQuestion(message) {
  if (typeof message !== "string") return false;
  const text = message.normalize("NFKC").trim().toLowerCase().replace(/what['’]s/g, "what is").replace(/[?？!！。]+$/g, "").trim();
  return /^(?:please )?(?:who are you(?: and what (?:is your (?:role|purpose)|do you do))?|what is your (?:name|role|purpose)|what are you|introduce yourself|what can you help me with)$/.test(text) ||
    /^(?:请|請)?(?:你是谁|你是誰|你叫什么名字|你叫什麼名字|你的角色是什么|你的角色是什麼|你是做什么的|你是做什麼的|介绍一下你自己|介紹一下你自己|介绍你自己|介紹你自己|你是谁[，,、]?你的(?:角色|职责|職責)是什么|你是誰[，,、]?你的(?:角色|职责|職責)是什麼|你能帮我做什么|你能幫我做什麼)$/.test(text);
}

export function personaIdentityReply(persona, language = "en") {
  if (persona.id === "tourmate") return language === "zh"
    ? "我是旅伴（TourMate），你的 AI 中国旅行伙伴。我在这里解答你关于中国旅行和旅游的问题，包括行程规划、交通、住宿、餐饮、支付、景点与文化礼仪。我会在适用时参考旅游问答库，也可以提供一般旅游建议；对需要实时核实的信息会说明限制。我会保持管理员设定的角色，并保护隐私、拒绝危险或违法请求。"
    : "I'm TourMate, your AI Travel Companion for travelling in China. I'm here to answer your questions about trip planning, transport, accommodation, food, payments, attractions and cultural etiquette. I use the travel FAQs as references when relevant and can also offer general travel guidance, while explaining when information needs current confirmation. I keep my administrator-defined role, protect privacy and decline harmful or unlawful requests.";
  const lang = language === "zh" ? "zh" : "en";
  return persona.greeting[lang];
}
