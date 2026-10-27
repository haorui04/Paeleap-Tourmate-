# Paeleap TourMate deployment gates

This repository ships restricted bilingual museum/tourism companions, not a general-purpose agent. TourMate can select approved records or, with `AI_RESPONSE_MODE=generated`, write responses using the 100 FAQs as references. Administrator-published museum profiles retain approved-record rendering. Review [generated-answer setup and limits](docs/GENERATED-ANSWERS.md) before enabling that mode. Do not claim live prices, bookings, timetables, routing or medically validated advice. [Current museum deployment steps](docs/MUSEUM-DEPLOYMENT.md) supersede the historical provider notes below.

Apply the **new** `personas-schema.sql`, `conversation-personas.sql` and `quota-hardening.sql` migrations before deploying this version, after validating them in staging. Configure server-only `PERSONA_ADMIN_USER_IDS`; then use `/admin` to upload reviewed JSON packages. Empty allowlist disables publication. This is deployment-wide administration, not organization-specific RBAC. Little De Rabbit is demonstration content, not an official De Shou service.

## Before deploying (required)

For the live city-weather tool, review [LIVE-WEATHER.md](docs/LIVE-WEATHER.md). The default free Open-Meteo configuration is for non-commercial use; commercial launch requires its commercial plan and server-only key. Verify an authenticated live lookup, saved timestamps, provider failure behavior and provider-wide traffic limits. No weather schema migration is required.

1. Use a dedicated Supabase project. Apply `supabase/schema.sql` and `supabase/faq-schema.sql` and then `supabase/faq-seed.sql`. Audit the RLS and function permissions in the deployed database.
2. Configure server-only provider credentials, exact model ID and explicit API protocol. Responses requests use `/v1/responses`, `input`, `stream:false`, `store:false`, and an output-token cap (384 for FAQ selection, 512 for evidence composition, 1536 for generated answers). Chat Completions/Anthropic requests use their own endpoint and `max_tokens`. Caps are never silently removed for compatibility. Verify provider support, Chinese replies, errors and a signed-in end-to-end request in staging; fixtures do not prove live availability.
3. Set `FAQ_BANK_SOURCE=supabase`; Vercel serverless functions must **not** use mutable local SQLite state. The API rejects SQLite configuration in production.
4. Configure `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` server-side; configure `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` for the browser **from the same project**. Never use a service-role/secret key under `NEXT_PUBLIC_`.
5. Set `ALLOW_LOCAL_DEMO=false`, `AI_MOCK_MODE=false`. These modes are also disabled automatically in production.
6. Configure Supabase email verification, Auth site URL and redirect URLs; enforce appropriate password policy, rate limits and anti-abuse controls. Ensure your privacy policy, data retention, deletion workflow and applicable China/other legal requirements have been reviewed.
7. Run `npm ci`, `npm run faq:check` **in local dev only** (it writes SQLite), `npm test`, `npm run build`. CI should not run the SQLite check as a production startup check.
8. Smoke test sign up, sign in, logout, new conversation, 100 FAQ answers, 10 high-risk prompts, 404 other-user conversation, 429 quota, provider failure, and bilingual mobile view. Confirm telemetry and spending limits on provider side.
9. Confirm real Chinese network accessibility, DNS, API provider availability, data residency and regulatory requirements for China-facing service.

## Known risks

- Rules and static FAQ answers are baseline, not independently certified. Human evaluation is required before open public access.
- The per-minute limiter caps individual user requests but does **not** enforce a global daily API budget. Add provider hard spend caps and monitoring.
- Authenticated transcripts reside in Supabase; browser localStorage retains only trip metadata and drafts for authenticated users. Supabase Auth itself may use browser storage for session tokens.
- There is no verified live DB / provider in the supplied artifact. A production **build** passing is necessary, but not sufficient to demonstrate a production-ready release.

## Miaoqu provider diagnostics and bounded fallback

If Miaoqu returns a successful HTTP response but the body has no OpenAI/Responses-style assistant text, the server logs only safe response-shape metadata (content type and boolean structure flags). It never logs raw upstream output, credentials, or prompts. The signed-in chat handler falls back to a **conservative exact/high-confidence FAQ match** using the existing curated bank, with `ai.mode=curated_faq_fallback`. If the bank cannot reliably match, it reports the AI service as temporarily unavailable rather than inventing an answer. This is a degraded service, **not proof that the Miaoqu AI integration works**. Check Vercel runtime logs after an unmatched tourism request to diagnose the gateway response shape.

### Sub2API protocol verification

The supplied Codex CLI configuration specifies `wire_api = "responses"`, `base_url = "https://api.miaoquai.com/v1"`, and model `deepseek-v4-pro`. The server now POSTs to `https://api.miaoquai.com/v1/responses` with the Responses API JSON shape, instead of sending Chat Completions data to the API base URL. Static/mocked tests verify the request schema and parser, but **only a live signed-in request** can verify compatibility with this particular Miaoqu provider account. The AI is still limited to selecting a curated FAQ ID; expanding to generative RAG is a separate project.


## Live Miaoqu Responses debugging (2026-10-20)

When the Responses endpoint rejects the request, Vercel logs
`Miaoqu Responses upstream rejection` with an HTTP status and
**redacted boolean diagnostics only**. Logs never contain API keys,
raw provider bodies or user questions. The chatbot's existing
curated-FAQ fallback remains active; it should not be interpreted as
proof of an AI-generated answer. Check the status on a fresh request:
- 400 / 422: inspect unsupported request-field flags or model access with the provider.
- 401 / 403: verify the encrypted provider key and Responses entitlement.
- 404: verify the correct inference endpoint and model.
- 429: provider rate limit or quota.
Do not disable safety filtering or turn on arbitrary generative answers to hide
upstream failures. The historical FAQ path selects IDs. The newer opt-in
`generated` mode is a separate reference-grounded answer path; it still requires
successful provider access and keeps failures visibly labeled as fallback.
