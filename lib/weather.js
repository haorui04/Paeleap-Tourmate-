import { classifyInput } from "./ai/safety.js";
import { hasConfiguredValue } from "./config.js";
import { WEATHER_CREDIT, WEATHER_SOURCES } from "./weather-format.js";

const cache = new Map();
const TTL = 5 * 60 * 1000;
const SOURCES = WEATHER_SOURCES;
const CONDITIONS = {
  0: ["Clear", "晴"], 1: ["Mainly clear", "基本晴朗"], 2: ["Partly cloudy", "局部多云"], 3: ["Overcast", "阴"],
  45: ["Fog", "雾"], 48: ["Rime fog", "雾凇"], 51: ["Light drizzle", "小毛毛雨"], 53: ["Drizzle", "毛毛雨"],
  55: ["Dense drizzle", "强毛毛雨"], 56: ["Light freezing drizzle", "小冻毛毛雨"], 57: ["Freezing drizzle", "冻毛毛雨"],
  61: ["Light rain", "小雨"], 63: ["Rain", "中雨"], 65: ["Heavy rain", "大雨"], 66: ["Light freezing rain", "小冻雨"],
  67: ["Freezing rain", "冻雨"], 71: ["Light snow", "小雪"], 73: ["Snow", "中雪"], 75: ["Heavy snow", "大雪"],
  77: ["Snow grains", "米雪"], 80: ["Light rain showers", "小阵雨"], 81: ["Rain showers", "阵雨"],
  82: ["Heavy rain showers", "强阵雨"], 85: ["Light snow showers", "小阵雪"], 86: ["Snow showers", "强阵雪"],
  95: ["Thunderstorm", "雷暴"], 96: ["Thunderstorm with hail", "雷暴伴冰雹"], 99: ["Thunderstorm with heavy hail", "雷暴伴强冰雹"]
};
const placeText = /^[\p{Script=Han}\p{Script=Latin}][\p{Script=Han}\p{Script=Latin}\p{M} '\u2019,.-]{0,79}$/u;
const placeKey = value => String(value).normalize("NFKD").toLowerCase().replace(/\p{M}/gu, "")
  .replace(/(?:\s+city|市)$/u, "").replace(/[^\p{L}]/gu, "");
const numeric = (value, min, max) => typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;

export function isWeatherRequest(message) {
  if (typeof message !== "string") return false;
  // Historical climate/packing advice stays on the ordinary travel path.
  if (/\b(?:usually|typical|average|climate|winter|summer|spring|autumn|warnings?|packing)\b|气候|氣候|平均|通常|冬季|夏季|春季|秋季|预警|預警|下雨天.*(?:旅游|旅遊|安排|活动|活動)/.test(message.toLowerCase())) return false;
  if (/^\s*ignore\b.{0,40}\b(?:weather|rain|forecast)\b|\bwhere\b.{0,30}\b(?:check|find|see)\b.{0,25}\bweather\b/i.test(message)) return false;
  return /\b(?:weather|temperature|forecast|rain|snow|raining|snowing)\b|\bhow (?:hot|cold) (?:is|will)\b|天气|天氣|气温|氣溫|下雨|下雪/i.test(message);
}

export function isWeatherFollowup(message, history = []) {
  const last = history.at(-1);
  return last?.role === "assistant" && (last.content.includes("Data: Open-Meteo — https://open-meteo.com/") || last.content.endsWith(WEATHER_CREDIT)) &&
    /^(?:(?:and|what about|how about)\s+)?(?:tomorrow|today|the day after tomorrow|tonight)[?!. ]*$|^(?:那|那么|那麼)?(?:明天|后天|後天|今晚)(?:呢|怎么样|怎麼樣)?[？?。！! ]*$/i.test(message.trim());
}

export function parseWeatherRequest(message) {
  if (!isWeatherRequest(message)) return null;
  let text = message.normalize("NFKC").trim().replace(/[?？!！。]+$/g, "").trim();
  text = text.replace(/\b(?:tommorow|tommorrow|tomorow)\b/gi, "tomorrow")
    .replace(/\bnext (?:few|several) days\b/gi, "next three days").replace(/未来几天|未來幾天|接下来几天|接下來幾天/gu, "未来三天")
    .replace(/\bwhat will (?:the )?weather be like\b/gi, "weather");
  text = text.replace(/\b(?:over|for|in) (?:the )?(?=next three days\b)/gi, '').replace(/\bthe (?=next three days\b)/gi, '')
    .replace(/\bfor (?=tomorrow\b|the day after tomorrow\b)/gi, '');
  text = text.replace(/^(?:can you|could you|would you|may i)\s+/i, "");
  text = text.replace(/^how (?:hot|cold) is (.+)$/i, "weather in $1");
  if (/https?:|www\.|localhost|[\\/%=@<>\[\]{};\n\r]|\b(?:url|endpoint|apikey|latitude|longitude)\b/i.test(text)) return { invalid: true };
  if (/\b(?:tonight|yesterday|last|next week|next month|next year|january|february|march|april|may|june|july|august|september|october|november|december)\b|\d{4}|今晚|昨天|下周|下週|下个月|下個月|明年|去年|\d+月/.test(text.toLowerCase())) return { unsupportedDate: true };
  let period = /\bforecast\b|预报|預報/i.test(text) ? "three_days" : "current";
  if (/\bday after tomorrow\b|后天|後天/i.test(text)) period = "day_after_tomorrow";
  else if (/\btomorrow\b|明天/i.test(text)) period = "tomorrow";
  else if (/\bnext (?:three|3) days\b|未来三天|未來三天/i.test(text)) period = "three_days";
  text = text.replace(/\b(?:(?:the )?day after tomorrow|next (?:three|3) days|right now|currently|now|today(?:['’]s)?|tonight|tomorrow|live|current)\b|后天|後天|未来三天|未來三天|现在|現在|目前|今天|今晚|明天/gi, " ").replace(/\s+/g, " ").trim();
  let city;
  const en = text.match(/^(?:(?:please )?(?:(?:what(?:'s| is)|how(?:'s| is)) (?:the )?|(?:show|tell|give)(?: me)? (?:the )?|check (?:the )?)?)?(?:weather|temperature|forecast)(?: like)?(?: (?:in|for|at) (.+))?$/i);
  const cityFirst = text.match(/^(?:(?:what(?:'s| is)|how(?:'s| is)) )?(.+?)(?:'s)? (?:weather|temperature|forecast)(?: like)?$/i);
  const rain = text.match(/^(?:is|will) it (?:be )?(?:raining|snowing|rain|snow) (?:in|at) (.+)$/i);
  const zh = text.match(/^(?:请问|請問|请帮我|請幫我|帮我|幫我|请|請)?(?:查询|查詢|查一下|看看|看一下|告诉我|告訴我)?(.+?)(?:的)?(?:天气预报|天氣預報|天气|天氣|气温|氣溫)(?:怎么样|怎麼樣|如何|怎样|怎樣|情况|情況|是多少)?$/u);
  const zhRain = text.match(/^(?:请问|請問)?(.+?)(?:会|會|是否会|是否會|有)?(?:下雨|下雪)(?:吗|嗎|么|麼)?$/u);
  city = en?.[1] || cityFirst?.[1] || rain?.[1] || zh?.[1] || zhRain?.[1];
  if (!city) return { needsCity: true, period };
  city = city.trim().replace(/^中国\s*|^中國\s*/u, "").replace(/\s+in china$/i, "");
  if (!placeText.test(city) || city.length > 60 || city.split(",").length > 2 ||
      /\b(?:and|or|versus|vs|also|then|ignore|system|developer|instructions?)\b|[和与與及、]/i.test(city)) return { invalid: true };
  if (/^(?:china|中国|中國)$/i.test(city)) return { needsCity: true, period };
  return { city, period };
}

function config(env) {
  if (env.WEATHER_ENABLED && env.WEATHER_ENABLED !== "true") throw new Error("weather_disabled");
  const plan = env.WEATHER_API_PLAN || "noncommercial";
  if (!["noncommercial", "commercial"].includes(plan)) throw new Error("weather_configuration");
  if (plan === "commercial" && (!hasConfiguredValue(env.OPEN_METEO_API_KEY) || env.OPEN_METEO_API_KEY.length > 512 || /\s/.test(env.OPEN_METEO_API_KEY))) throw new Error("weather_configuration");
  return plan === "commercial" ? {
    geo: "https://customer-geocoding-api.open-meteo.com/v1/search", forecast: "https://customer-api.open-meteo.com/v1/forecast", key: env.OPEN_METEO_API_KEY
  } : { geo: "https://geocoding-api.open-meteo.com/v1/search", forecast: "https://api.open-meteo.com/v1/forecast" };
}

async function jsonFromProvider(url, fetchImpl) {
  // No visitor headers, cookies, history, full prompts or private data are sent.
  const response = await fetchImpl(url.toString(), { headers: { Accept: "application/json" }, redirect: "error",
    signal: AbortSignal.timeout(8000), cache: "no-store" });
  if (!response.ok || response.redirected || !(response.headers.get("content-type") || "").toLowerCase().startsWith("application/json")) throw new Error("weather_provider");
  if (Number(response.headers.get("content-length")) > 65536) throw new Error("weather_provider");
  const reader = response.body?.getReader();
  if (!reader) throw new Error("weather_provider");
  let size = 0; const chunks = [];
  try {
    for (;;) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > 65536) { await reader.cancel(); throw new Error("weather_provider"); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  let data;
  try { data = JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { throw new Error("weather_provider"); }
  if (!data || Array.isArray(data) || typeof data !== "object" || data.error) throw new Error("weather_provider");
  return data;
}

async function locateCity(city, cfg, fetchImpl) {
  const first = city.split(",")[0].trim();
  const key = placeKey(first);
  const country = ["hongkong", "香港"].includes(key) ? "HK" : ["macau", "macao", "澳门", "澳門"].includes(key) ? "MO"
    : ["taipei", "台北", "臺北"].includes(key) ? "TW" : "CN";
  const aliases = { peking: "Beijing", canton: "Guangzhou" };
  const query = aliases[key] ? aliases[key] + city.slice(first.length) : city;
  const expected = placeKey(query.split(",")[0]);
  const url = new URL(cfg.geo);
  url.search = new URLSearchParams({ name: query, count: "5", language: /\p{Script=Han}/u.test(query) ? "zh" : "en", format: "json", countryCode: country }).toString();
  if (cfg.key) url.searchParams.set("apikey", cfg.key);
  const data = await jsonFromProvider(url, fetchImpl);
  if (data.results === undefined) return null;
  if (!Array.isArray(data.results) || data.results.length > 5) throw new Error("weather_provider");
  const candidates = new Map();
  for (const row of data.results) {
    if (!row || row.country_code !== country || typeof row.name !== "string" || !placeText.test(row.name) || placeKey(row.name) !== expected ||
        !/^(?:PPLC|PPLA[1-5]?|PPL)$/.test(row.feature_code || "") ||
        !numeric(row.latitude, 0, 60) || !numeric(row.longitude, 70, 140)) continue;
    candidates.set(row.latitude.toFixed(1) + ":" + row.longitude.toFixed(1), { latitude: row.latitude, longitude: row.longitude,
      administrative: row.feature_code !== "PPL" });
  }
  // Prefer a unique capital/administrative city to homonymous small settlements.
  // Multiple administrative matches still require an explicit province.
  const cities = [...candidates.values()].filter(row => row.administrative);
  if (cities.length === 1) return cities[0];
  if (candidates.size > 1) return { ambiguous: true };
  return [...candidates.values()][0] || null;
}

const localDate = time => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(time));
const localTime = time => new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(time));

export function validateWeatherPayload(data, location, now = Date.now()) {
  const c = data.current; const u = data.current_units; const d = data.daily; const du = data.daily_units;
  if (data.timezone !== "Asia/Shanghai" || data.utc_offset_seconds !== 28800 ||
      !numeric(data.latitude, location.latitude - 1, location.latitude + 1) || !numeric(data.longitude, location.longitude - 1, location.longitude + 1) ||
      !c || !u || u.time !== "unixtime" || u.temperature_2m !== "°C" || u.apparent_temperature !== "°C" ||
      u.relative_humidity_2m !== "%" || u.precipitation !== "mm" || u.wind_speed_10m !== "km/h" || u.weather_code !== "wmo code" ||
      !numeric(c.time, now / 1000 - 5400, now / 1000 + 900) || !Number.isInteger(c.time) ||
      !numeric(c.temperature_2m, -90, 65) || !numeric(c.apparent_temperature, -110, 85) ||
      !numeric(c.relative_humidity_2m, 0, 100) || !numeric(c.precipitation, 0, 1000) || !numeric(c.wind_speed_10m, 0, 500) ||
      !Object.hasOwn(CONDITIONS, c.weather_code) || !Number.isInteger(c.weather_code)) throw new Error("weather_invalid_data");
  const fields = ["time", "weather_code", "temperature_2m_max", "temperature_2m_min", "precipitation_probability_max"];
  if (!d || !du || fields.some(field => !Array.isArray(d[field]) || d[field].length !== 3) ||
      du.time !== "unixtime" || du.weather_code !== "wmo code" || du.temperature_2m_max !== "°C" || du.temperature_2m_min !== "°C" || du.precipitation_probability_max !== "%") throw new Error("weather_invalid_data");
  const daily = d.time.map((time, index) => {
    if (!numeric(time, now / 1000 - 86400, now / 1000 + 3 * 86400) || !Number.isInteger(time) ||
        localDate(time * 1000) !== localDate(now + index * 86400000) ||
        !Number.isInteger(d.weather_code[index]) || !Object.hasOwn(CONDITIONS, d.weather_code[index]) ||
        !numeric(d.temperature_2m_min[index], -90, 65) || !numeric(d.temperature_2m_max[index], d.temperature_2m_min[index], 65) ||
        !numeric(d.precipitation_probability_max[index], 0, 100)) throw new Error("weather_invalid_data");
    return { time, code: d.weather_code[index], min: d.temperature_2m_min[index], max: d.temperature_2m_max[index], rain: d.precipitation_probability_max[index] };
  });
  // Only these validated numeric fields leave the provider adapter. All other
  // fields, including strings/instructions/URLs, are discarded before rendering.
  return { time: c.time, temperature: c.temperature_2m, feels: c.apparent_temperature,
    humidity: c.relative_humidity_2m, precipitation: c.precipitation, wind: c.wind_speed_10m, code: c.weather_code, daily };
}

function renderWeather(city, period, weather, now, language) {
  const zh = language === "zh"; const condition = code => CONDITIONS[code][zh ? 1 : 0];
  const n = value => Number(value.toFixed(1)).toString();
  const lines = [zh ? `地点：${city}` : `Place: ${city}`];
  if (period === "current") lines.push(zh
    ? `天气：${condition(weather.code)}\n气温：${n(weather.temperature)} °C\n湿度：${n(weather.humidity)}%`
    : `Weather: ${condition(weather.code)}\nTemperature: ${n(weather.temperature)} °C\nHumidity: ${n(weather.humidity)}%`);
  else {
    lines.push(zh ? "天气预报" : "Forecast");
    const rows = period === "tomorrow" ? [weather.daily[1]] : period === "day_after_tomorrow" ? [weather.daily[2]] : weather.daily;
    for (const row of rows) lines.push(`${localDate(row.time * 1000)} · ${condition(row.code)} · ${n(row.min)}–${n(row.max)} °C`);
  }
  lines.push(zh ? `时间：${localTime(now)}（北京时间）` : `Time: ${localTime(now)} (China time)`);
  return lines.join("\n") + "\n\n" + WEATHER_CREDIT;
}

export async function getWeatherReply({ message, history = [], language = "en", env = process.env, fetchImpl = fetch, now = Date.now(), cacheStore = cache }) {
  const zh = language === "zh";
  const classified = classifyInput(message, language);
  if (classified.status !== "allowed") return { reply: classified.reply, status: classified.status, sources: [], mode: "weather_unavailable" };
  let query = message;
  if (isWeatherFollowup(message, history)) {
    const previous = history.at(-1).content;
    const city = previous.endsWith(WEATHER_CREDIT) ? previous.match(/^(?:Place: |地点：)([^\n]{1,60})\n/)?.[1] : null;
    if (city && placeText.test(city)) query = `Weather in ${city} ` + (/后天|後天|day after tomorrow/i.test(message) ? 'the day after tomorrow'
      : /明天|tomorrow/i.test(message) ? 'tomorrow' : /今晚|tonight/i.test(message) ? 'tonight' : 'today');
  }
  const request = parseWeatherRequest(query);
  const clarify = reply => ({ reply, status: "allowed", sources: [], mode: "weather_clarification" });
  if (!request || request.needsCity) return clarify(zh ? "请告诉我需要查询天气的中国城市，例如：北京现在的天气，或上海明天的天气。" : "Which city in China would you like weather for? For example: weather in Beijing now, or Shanghai tomorrow.");
  if (request.invalid) return clarify(zh ? "请只提供一个城市名称，不要添加网址、地址或工具指令。例如：北京天气。" : "Please provide one city name without URLs, street addresses or tool instructions. For example: weather in Beijing.");
  if (request.unsupportedDate) return clarify(zh ? "我可以查询当前天气及今天起三天内的预报。请给出城市，并选择现在、明天或后天。" : "I can look up current conditions and the three-day forecast starting today. Please give a city and choose now, tomorrow or the day after tomorrow.");
  try {
    const cfg = config(env);
    const key = (env.WEATHER_API_PLAN || "noncommercial") + ":" + request.city.toLowerCase();
    for (const [id, entry] of cacheStore) if (now < entry.fetchedAt || now - entry.fetchedAt >= TTL || localDate(now) !== localDate(entry.fetchedAt) ||
        !numeric(entry.weather?.time, now / 1000 - 5400, now / 1000 + 900)) cacheStore.delete(id);
    let entry = cacheStore.get(key);
    if (!entry) {
      const location = await locateCity(request.city, cfg, fetchImpl);
      if (!location) return { ...clarify(zh ? "我只查询中国旅行目的地的天气。未能可靠找到该城市，请核对名称或补充省份。" : "I only look up weather for China-travel destinations. I couldn't reliably locate that city; please check its name or include its province."), status: "redirected" };
      if (location.ambiguous) return clarify(zh ? "有多个城市与这个名称匹配。请补充省份，例如 Suzhou, Jiangsu，避免查询到错误地点。" : "More than one city matches that name. Please include its province, for example Suzhou, Jiangsu, so I don't show the wrong location's weather.");
      const url = new URL(cfg.forecast);
      url.search = new URLSearchParams({ latitude: String(location.latitude), longitude: String(location.longitude),
        current: "temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m",
        daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max", forecast_days: "3",
        timezone: "Asia/Shanghai", timeformat: "unixtime", temperature_unit: "celsius", wind_speed_unit: "kmh", precipitation_unit: "mm" }).toString();
      if (cfg.key) url.searchParams.set("apikey", cfg.key);
      entry = { weather: validateWeatherPayload(await jsonFromProvider(url, fetchImpl), location, now), fetchedAt: now };
      if (cacheStore.size >= 200) cacheStore.delete(cacheStore.keys().next().value);
      cacheStore.set(key, entry);
    }
    return { reply: renderWeather(request.city, request.period, entry.weather, now, language), status: "allowed", sources: SOURCES,
      mode: request.period === "current" ? "weather_current" : "weather_forecast" };
  } catch {
    // Never invent current weather, send the request to the LLM as fallback,
    // or expose upstream bodies, API-key-bearing URLs or raw exceptions.
    return { reply: zh ? "暂时无法获取可靠的最新天气数据。我不会猜测当前天气，请稍后重试或查看当地官方天气服务。"
      : "I can't retrieve reliable up-to-date weather right now. I won't guess the current conditions. Please retry later or check the local official weather service.",
      status: "allowed", sources: [], mode: "weather_unavailable" };
  }
}
