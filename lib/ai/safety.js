import { tourismOnlyReply } from "../tourism/faq-matching.js";
import { normalizeForSafety } from "./input-normalization.js";

/**
 * Deterministic safety layer for a tourism-only pilot.
 * These rules are a first defence, not a comprehensive content-moderation system.
 */
const injection = [
  /\b(?:suspend|abandon|stop|replace|disable|cancel)\b.{0,45}\b(?:travel|tourism|tour)\b.{0,25}\b(?:role|restrictions?|limits?|rules?)|\byou are no longer\b.{0,45}\b(?:tour|travel|companion)|\bfrom now on you are\b/i,
  /\b(?:system update|configuration override)\s*:|\[developer\]|<system\b|\brole\s*=\s*unrestricted|\b(?:authori[sz]es?|permission for)\b.{0,45}\b(?:forgery|theft|harm|private data)/i,
  /\b(?:quote|repeat|return)\b.{0,60}\binstructions?\b.{0,50}\b(?:before my first message|before (?:this|my) (?:message|conversation))|\bfaq_match_system_prompt\b|\b(?:raw prompt|complete developer prompt|secret rules)\b/i,
  /(?:reveal|show|print|leak|expose|repeat|dump|display|translate|summari[sz]e|return|output|quote|reproduce|list|complete)\b.{0,85}\b(?:system|developer|hidden|initial|internal|private)\b.{0,35}\b(?:instructions?|prompts?|rules?|messages?|configuration|reasoning|chain.of.thought)/i,
  /(?:不再是|暂停|暫停|取消).{0,20}(?:旅游|旅遊).{0,15}(?:角色|助手|限制)|(?:切换角色|切換角色|改成|扮演).{0,25}(?:黑客|操控|不受规则|不受規則|无任何限制|無任何限制)|(?:系统通知|系統通知|开发者最高|開發者最高)/i,
  /(?:系统指令|系統指令|隐藏提示词|隱藏提示詞|内部开发者消息|內部開發者消息).{0,35}(?:复述|複述|转写|轉寫|编码|編碼|发给|發給)|(?:转写|轉寫|编码|編碼|复述|複述|输出|輸出).{0,35}(?:隐藏提示词|隱藏提示詞|后台私人密钥|後台私人密鑰)/i,
  /\b(?:ignore|disregard|forget|override|bypass|replace)\b.{0,65}\b(?:instructions?|rules?|prompts?|guardrails?|polic(?:y|ies)|restrictions?|role|tourism.only)\b/i,
  /i[\s_.-]*g[\s_.-]*n[\s_.-]*o[\s_.-]*r[\s_.-]*e.{0,50}(?:instructions?|rules?|prompts?)/i,
  /(?:reveal|show|print|leak|expose|repeat|dump|display|translate|summari[sz]e)\b.{0,55}\b(?:system|developer|hidden|initial|internal)\b.{0,25}\b(?:instructions?|prompts?|messages?|configuration|reasoning|chain.of.thought)/i,
  /\b(?:you are now|act as|behave as|become|pretend (?:you are|to be)|assume the role of)\b.{0,60}\b(?:unrestricted|uncensored|dan|jailbroken|developer|system|hacker|general.purpose|poet|comedian|translator|criminal|different assistant|not a tour|no restrictions)/i,
  /\b(?:developer|god|jailbreak|unrestricted|admin)\s*mode\b|\bdo anything now\b|\b(?:stop|cease) being (?:a |an )?(?:tour|travel|tourism)/i,
  /\b(?:new|replace (?:your|the)|change (?:your|the))\s+(?:role|instructions?|system prompt|rules?)\b|\b(?:your|the) (?:new )?role\s*(?:is|=|:)/i,
  /(?:^|\n)\s*(?:system|developer)\s*:|<\|(?:im_start|system|developer)\|>|\[\/?inst\]|<<\/?sys>>|"role"\s*:\s*"(?:system|developer)"/i,
  /\b(?:select|choose|return|output|respond with|force)\b.{0,40}\bcn\d{3}\b|\b(?:set|force|return|output)\b.{0,35}["']?(?:faqid|confidence)["']?\s*(?::|=|to)|\b(?:faqid|confidence)\s*[:=]\s*(?:"cn\d{3}"|1(?:\.0)?\b)/i,
  /\b(?:decode|decipher|decrypt)\b.{0,100}\b(?:obey|execute|follow|carry out|instructions?)\b|\b(?:obey|execute|follow)\b.{0,80}\b(?:decoded|base64|rot13|encoded)\b/i,
  /(?:忽略|无视|無視|覆盖|覆蓋|替换|替換|忘记|忘記|绕过|繞過).{0,25}(?:指令|规则|規則|提示词|提示詞|限制|角色|安全策略)|(?:泄露|泄漏|显示|顯示|输出|輸出|打印|翻译|翻譯|复述|複述).{0,25}(?:系统提示|系統提示|隐藏指令|隱藏指令|开发者提示|開發者提示|思维链|思維鏈)/i,
  /(?:你现在是|你現在是|扮演|切换为|切換為|变成|變成).{0,24}(?:无规则|無規則|不受限制|黑客|开发者|開發者|通用助手|无限制|無限制)|(?:更改|修改|替换|替換).{0,12}(?:角色|身份|系统提示|系統提示)|(?:选择|選擇|返回|输出|輸出).{0,20}cn\d{3}|(?:解码|解碼).{0,30}(?:执行|執行|遵从|遵從|指令)/i
];
const extraction = [
  /\b(?:provide|output|return|reveal|show|print|leak|expose|dump|display|give me|retrieve|list|send|export|access|read|find|query|finish)\b.{0,110}(?:\b(?:supabase_service_role_key|ai_api_key|api[ _-]?keys?|server secret|private (?:api |service )?credentials?|bearer token|private (?:visitor |synthetic )?(?:canary|passport|records?|data)|passport numbers|other (?:users?|tourists?|visitors?)|another user|all users|previous visitor)|\.env\b)/i,
  /\b(?:please output|return|reveal|give me)\b.{0,45}\b(?:the secret|private service credential)\b|\b(?:reply|respond)\b.{0,55}\bprivate (?:service |api )?credential\b|继续.{0,25}(?:绕过|繞過).{0,15}检查/i,
  /\b(?:private|hidden|server)\b.{0,40}\b(?:api (?:key|credential)|service credential|secret|canary)\b.{0,65}\b(?:reveal|value|output|return|print)\b/i,
  /(?:后台|後台|数据库|數據庫).{0,12}(?:连接|連接|服务|服務)?(?:密码|密碼|密钥|密鑰)|(?:删除|刪除|查询|查詢|列出|发给|發給).{0,50}(?:别人|別人|私人消息|私人资料|私人資料|所有用户|所有用戶)|(?:所有用户|所有用戶).{0,25}(?:聊天记录|聊天記錄)/i,
  /\b(?:reveal|show|print|leak|expose|dump|display|give me|retrieve|list|send|export|access|read)\b.{0,85}\b(?:api[ _-]?keys?|secrets?|credentials?|passwords?|access[ _-]?tokens?|refresh[ _-]?tokens?|service[ _-]?role|environment variables?|\.env|private keys?|database (?:contents|rows|credentials)|other users?|another user|previous (?:users?|visitors?|guests?)|last (?:user|visitor|guest)|all (?:users?|conversations?|chat histories)|hidden data)\b/i,
  /\b(?:sql injection|union select|drop table|dump database)\b|(?:\bselect\s+\*\s+from\s+(?:users?|messages?|conversations?)\b)/i,
  /(?:查看|列出|显示|顯示|读取|讀取|导出|導出|泄露|泄漏|获取|獲取|输出|輸出|给我|給我).{0,35}(?:其他用户|其他用戶|别人的|別人的|上一位游客|所有用户|所有用戶|聊天记录|聊天記錄|密钥|密鑰|密码|密碼|访问令牌|訪問令牌|环境变量|環境變量|数据库内容|數據庫內容|私钥|私鑰)/i
];
const restricted = [
  /(?:bypass|enter|cross|climb|sneak).{0,45}(?:closed|restricted|barrier|fence|no.entry)/i,
  /(?:closed|restricted).{0,45}(?:trail|path|area).{0,25}(?:enter|access|cross)/i,
  /(?:翻越|闯入|绕过).{0,20}(?:封闭|围栏|禁区)|(?:禁区|封闭区域).{0,15}(?:怎么进入|如何进入)/i
];
// Request-focused patterns: defensive questions about scams, lost documents,
// restrictions, customs, food allergies or police remain in scope. The label
// means a risky request pattern was detected, not knowledge of a user's mind.
const harmfulRequests = [
  /\b(?:how|teach|instruct|steps?|help|guide|suggest|instructions?|method|plan|want|need)\b.{0,120}\b(?:steal|pickpocket|rob|kidnap|assault|poison|kill|murder|stalk|blackmail|smuggle|bribe|launder|forge|injure|sabotage|scam|theft plan|forged.document plan)\b/i,
  /\b(?:plan|instructions?|method)\b.{0,60}\b(?:physical attack|setting.{0,25}on fire)|\b(?:create|make|generate|write)\b.{0,60}\bfake\b.{0,35}\b(?:payment link|bank login|refund|document|visa|passport)/i,
  /\b(?:evade|bypass|avoid|defeat|disable|conceal|hide|hiding|trespass(?:ing)?|entering)\b.{0,80}\b(?:security (?:checkpoint|screening)|prohibited|illegal drugs?|fire alarm|smoke alarm|closed|closure|protected heritage|detection)|\b(?:smuggle|sabotage|phishing|ransomware)\b/i,
  /(?:教我|指导|指導|如何|怎么|怎麼|怎样|怎樣|帮我|幫我|我要|我想|告诉我|告訴我|给出|給出).{0,55}(?:盗取|盜取|盗刷|盜刷|偷走|伤害|傷害|袭击|襲擊|威胁|威脅|破坏|破壞|策划袭击|策劃襲擊|钓鱼短信|釣魚短信)|(?:制作|製作|制造|製造).{0,25}(?:爆炸装置|爆炸裝置)|(?:躲过|躲過).{0,40}(?:进入|進入|禁止)|(?:关闭|關閉).{0,25}(?:烟雾报警器|煙霧報警器|火灾报警|火災報警)/i,
  /\b(?:how (?:can|do|to)|teach|instruct|steps? to|help me|guide me|where can i|i want to|i need to)\b.{0,100}\b(?:steal|pickpocket|rob|kidnap|assault|attack (?:a |the )?(?:person|tourist|crowd)|poison|kill|murder|stalk|blackmail|smuggle|bribe|traffic (?:a |the )?(?:person|child)|launder|forge|counterfeit)\b/i,
  /\b(?:make|build|assemble|create|obtain|buy|hide|carry|manufacture|acquire)\b.{0,60}\b(?:bombs?|explosives?|illegal weapons?|unregistered guns?|forged passports?|fake (?:passport|visa|id)|counterfeit (?:passport|visa|ticket|currency)|poison|illegal drugs?|cocaine|heroin|methamphetamine)\b/i,
  /\b(?:bypass|evade|avoid|defeat|disable|sneak (?:past|through)|get around)\b.{0,65}\b(?:customs (?:checks?|inspection)|passport (?:control|checks?)|immigration (?:checks?|control)|airport security|metal detectors?|cctv|security cameras?|payment|ticket (?:checks?|barriers?)|police detection|safety checks?|identity verification|age verification)\b/i,
  /\b(?:break into|hack|crack|phish|steal)\b.{0,70}\b(?:hotel room|wifi|wi.fi|account|password|alipay|wechat|phone|wallet|card|bank|booking|email)\b/i,
  /\b(?:write|create|generate|give me|send|compose)\b.{0,80}\b(?:phishing|ransomware|malware|hate speech|death threat|suicide instructions|sexual (?:content|images?).{0,15}(?:child|minor))\b/i,
  /\b(?:how|steps?|instructions?|best way|method)\b.{0,85}\b(?:suicide|kill myself|self.harm|sexually exploit|drug (?:a |the )?(?:tourist|person|drink)|exploit (?:a |the )?(?:child|minor))\b/i,
  /(?:教我|指导|指導|如何|怎么|怎麼|怎样|怎樣|帮我|幫我|我要|我想|哪里能|哪裡能|给我步骤|給我步驟).{0,45}(?:盗窃|盜竊|偷窃|偷竊|偷取|抢劫|搶劫|绑架|綁架|杀人|殺人|投毒|下毒|走私|行贿|行賄|洗钱|洗錢|伪造|偽造|诈骗|詐騙|自杀|自殺|自残|自殘|跟踪别人|跟蹤別人|窃取|竊取)/i,
  /(?:制作|製作|制造|製造|购买|購買|买|買|藏匿|携带|攜帶).{0,25}(?:炸弹|炸彈|爆炸物|假护照|假護照|假签证|假簽證|假身份证|假身份證|毒品|海洛因|冰毒|非法枪支|非法槍支)|(?:绕过|繞過|逃避|躲避|避开|避開).{0,25}(?:安检|安檢|海关检查|海關檢查|移民检查|移民檢查|身份核验|身份核驗|监控|監控|检票|檢票)|(?:破解|黑进|黑進|入侵).{0,25}(?:酒店|账号|賬號|支付|wifi|wi.fi|手机|手機)/i
];
const emergencies = [
  /\b(?:unconscious|unresponsive|severe bleeding|heart attack|chest pain|cannot breathe|difficulty breathing|serious injury|head injury|heat stroke)\b/i,
  /(?:失去意识|昏迷|大量出血|呼吸困难|胸痛|严重受伤|中暑)/i
];
const outsideScope = [
  /\b(?:cryptocurrenc(?:y|ies)|cryptocurrency speculation|quantum entanglement|quantum physics|calculus homework|stock.market advis(?:er|or)|algebra homework)\b/i,
  /(?:写|寫|创作|創作|生成).{0,18}(?:诗|詩)|(?:数学作业|數學作業|量子纠缠|量子糾纏|加密货币投资|加密貨幣投資)/i,
  /\b(?:invent|fabricate|make up|guarantee)\b.{0,110}\b(?:price|source|visa|fact|answer|documents?|verified|opening|ticket)|\bpretend (?:it is|to be) verified\b/i,
  /(?:编造|編造|捏造|虚构|虛構|直接编|直接編).{0,60}(?:票价|票價|时间|時間|公告|答案|发车|發車)|(?:不要承认不知道|不要承認不知道)/i,
  /\b(?:run|execute|open|fetch|visit|delete|send|book and pay)\b.{0,110}\b(?:shell command|sql|environment variables|169\.254\.169\.254|localhost|127\.0\.0\.1|previous visitor|internal configuration|another visitor)/i,
  /\b(?:write|generate|create|debug|implement)\b.{0,45}\b(?:malware|virus|python code|javascript code|program|script)\b/i,
  /(?:编写|生成).{0,30}(?:代码|恶意软件|病毒)/i,
  /\b(?:write|compose|tell|generate)\b.{0,45}\b(?:poem|joke|essay|song|fiction|horoscope)\b|\b(?:stock trading|investment advice|solve (?:my |this )?(?:math|homework))\b/i,
  /(?:写|寫|创作|創作|讲|講).{0,15}(?:诗歌|詩歌|笑话|笑話|小说|小說)|(?:股票投资|股票投資|解数学题|解數學題)/i
];

function messageFor(status, lang) {
  const zh = lang === "zh";
  const texts = {
    emergency: zh
      ? "这可能是紧急情况。请立即联系当地急救服务，远离危险区域，并向附近工作人员寻求帮助。不要仅依靠聊天机器人处理紧急情况。"
      : "This may be an emergency. Contact local emergency services now, move away from danger if safe, and ask nearby staff for help. Do not rely on a chatbot for urgent assistance.",
    blocked: zh
      ? "我不能协助危险或违法行为、绕过安全限制、改变助手的安全角色，或披露私人数据与隐藏指令。我可以回答中国旅游问答库范围内的安全旅行问题。"
      : "I can't help with harmful or illegal activity, bypass safety restrictions, change my safety role, or disclose private data or hidden instructions. I can help with safe China-tourism questions covered by the FAQ bank.",
    redirected: tourismOnlyReply(lang)
  };
  return texts[status];
}

export function classifyInput(message, language = "en") {
  if (typeof message !== "string" || !message.trim() || message.length > 1500) {
    return { status: "invalid", reply: null };
  }
  // Remove only narrowly recognizable defensive verb phrases, not the whole
  // request. A malicious second clause is still scanned and cannot inherit an
  // allow decision merely by adding a safety question or negation.
  let text = normalizeForSafety(message)
    .replace(/\bavoid\s+(?:accidentally\s+)?entering\b/g, "stay away from")
    .replace(/\bavoid\s+(airport security|customs|immigration)\s+(?:delays?|queues?)\b/g, "reduce waiting at $1")
    .replace(/(?:避免|预防|預防)(?:诈骗|詐騙|盗窃|盜竊|偷窃|偷竊)/g, "预防旅游风险");
  if (/^if someone tells me to .{0,120},?\s*should i (?:refuse|report (?:it|them))\?\s*$/i.test(message.trim())) {
    text = text.replace(/\bignore safety instructions\b/g, "violate safety advice");
  }
  // A harmful clause must not be laundered by adding an emergency keyword.
  if ([...injection, ...extraction, ...restricted, ...harmfulRequests].some(rule => rule.test(text))) {
    return { status: "blocked", reply: messageFor("blocked", language) };
  }
  if (emergencies.some(rule => rule.test(text))) return { status: "emergency", reply: messageFor("emergency", language) };
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
