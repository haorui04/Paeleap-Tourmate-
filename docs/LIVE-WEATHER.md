# Live city weather

TourMate can retrieve current weather and the three-day forecast starting today for a named Chinese city. This is a controlled backend lookup, separate from DeepSeek text generation. No database migration or additional npm package is needed.

Examples: `What is the weather in Beijing now?`, `Weather in Shanghai tomorrow`, `What is the weather in Shanghai tommorow?`, `Shanghai weather over the next few days`, `杭州现在的天气`, `上海未来几天的天气`, `北京明天会下雨吗`. For a name shared by multiple administrative cities, include a province: `Weather in Suzhou, Jiangsu`. Exact city-name matching is intentional; unrecognized city spellings require clarification. Long-range dates, night-specific forecasts, street addresses, GPS coordinates and multiple cities in one request are not supported. Historical climate, rainy-day activity and warning-source questions remain on the ordinary tourism-answer path. Bare follow-ups such as `What about tomorrow?` reuse a bounded city only from the immediately preceding credited server weather reply. Missing or older-format context asks for an explicit city; no model extrapolates a forecast.

## Request and security flow

1. The existing signed-in `POST /api/chat` validates the body, Supabase session, per-user quota (6/minute and 60/day), conversation ownership and pinned persona/version.
2. Existing input and persona guardrails run before weather lookup. Mixed jailbreak/weather requests do not bypass those checks. Global city weather is enabled only for TourMate; museum profiles retain venue scope.
3. A bounded parser extracts one city and a supported period. Visitors cannot provide a URL, HTTP header, tool command or provider configuration. Country filtering and exact returned name matching constrain geocoding; a unique capital/administrative city takes precedence over homonymous small settlements. Ambiguous administrative matches request a province.
4. The server sends the city to a fixed Open-Meteo geocoding host, then only validated coordinates and fixed field names to its fixed forecast host. The full prompt, chat history, visitor token and private profile data are never sent to the weather provider. The server makes two GET requests on a cold lookup. Redirects are rejected, each request has an 8-second timeout and each response is actively limited to 64 KiB.
5. The adapter checks JSON shape, coordinates, units, timezone, numeric bounds, known weather codes, observation/model timestamp (no more than 90 minutes old or 15 minutes ahead) and three consecutive forecast dates. It discards arbitrary descriptions, links and instructions in provider payloads. DeepSeek never interprets weather responses or chooses tool destinations.
6. Validated numeric values and static bilingual condition names render into the existing chat bubble. Current replies show only Place, Weather, Temperature, Humidity and the current query time in China time. Forecast replies show the place, dated condition/temperature-range rows and query time. Daily humidity is not supplied by the selected daily forecast fields, so no forecast humidity is invented. Attribution stays in the stored text and a collapsible source disclosure in the UI. Current conditions are weather-model estimates, not a local sensor measurement. Local official warnings remain the appropriate source for outdoor safety decisions.
7. The existing atomic exchange writer saves the reply. Source and time text remains in the transcript even when database history lacks structured provenance metadata. Old messages are historical snapshots; they do not refresh automatically. Ask again for an update.

If the provider fails, returns malformed/stale data or cannot identify a city reliably, TourMate reports that condition or asks for clarification. It never guesses current weather or sends a failed live lookup to the model as fallback. Weather does not grant the model general browsing or tool access.

## Configuration

| Server variable | Setting |
| --- | --- |
| `WEATHER_ENABLED` | `true` or omitted enables the tool; `false` disables outbound lookups. Redeploy after changing Vercel environment variables. |
| `WEATHER_API_PLAN` | `noncommercial` (default) uses the free hosts. `commercial` requires a purchased key and uses only the fixed customer hosts. An invalid value fails closed. |
| `OPEN_METEO_API_KEY` | Server-only commercial key; never use `NEXT_PUBLIC_` or put it in a persona file, prompt, Git commit or browser code. Not required for non-commercial use. |

Free hosts: `geocoding-api.open-meteo.com` and `api.open-meteo.com`. Commercial hosts: `customer-geocoding-api.open-meteo.com` and `customer-api.open-meteo.com`. There is no endpoint override. Commercial credentials remain restricted to those hosts and never appear in replies. The key is a provider-required query parameter, so infrastructure operators must also redact outbound query URLs in any future HTTP tracing.

Weather uses a five-minute, maximum-200-entry per-process cache of public numeric data, purged at the China-time date boundary. Auth and quotas still apply to cache hits. Serverless instances do not share this cache; it is not a global provider budget or guaranteed call cap.

## Licensing and launch limits

The Open-Meteo free API permits non-commercial use only. Its published limits are below 10,000 calls/day, 5,000/hour and 600/minute; shared hosting IPs can be limited earlier. A commercial museum product, promotion, advertising or paid service needs the appropriate commercial plan before launch. This implementation does not purchase one or certify commercial eligibility. Set a provider budget/monitoring and platform abuse controls before broad public traffic.

Replies credit Open-Meteo, GeoNames location data and CC BY 4.0 with fixed HTTPS links. Forecasts can change, availability is not guaranteed, and no severe-weather warning feed is integrated. Verify accessibility and data/legal requirements for your intended deployment region separately.

Sources: [forecast API](https://open-meteo.com/en/docs), [geocoding and attribution](https://open-meteo.com/en/docs/geocoding-api), [terms and limits](https://open-meteo.com/en/terms), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

## Verification

Run `node --test tests/weather.test.mjs`, `npm test`, `npm run test:syntax` and `npm run build`. The weather suite uses synthetic provider/database fixtures and explicitly tests malicious URLs, prompt injection, provider instruction strings, wrong country/location, ambiguous cities, invalid units/timestamps/numbers, redirects, oversized streams, outages, configuration controls and API integration. Fixtures establish deterministic behavior, not provider uptime. Complete a real signed-in weather request on the deployed site and verify its saved exchange before release. No live-weather claim should rely only on `/api/status` or a passing build.
