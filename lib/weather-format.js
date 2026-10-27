// Preserve required attribution in saved transcripts while keeping the visible
// weather answer compact. The UI presents this fixed footer in a disclosure.
export const WEATHER_CREDIT = "Weather sources: Open-Meteo https://open-meteo.com/ · GeoNames https://www.geonames.org/ · CC BY 4.0 https://creativecommons.org/licenses/by/4.0/";
export const WEATHER_SOURCES = [
  { name: "Open-Meteo", url: "https://open-meteo.com/" },
  { name: "GeoNames", url: "https://www.geonames.org/" },
  { name: "CC BY 4.0", url: "https://creativecommons.org/licenses/by/4.0/" }
];
export function compactWeatherView(reply) {
  if (typeof reply !== "string" || !/^(?:Place: |地点：)/u.test(reply) || !reply.endsWith("\n\n" + WEATHER_CREDIT)) return null;
  return { text: reply.slice(0, -(WEATHER_CREDIT.length + 2)), sources: WEATHER_SOURCES };
}
