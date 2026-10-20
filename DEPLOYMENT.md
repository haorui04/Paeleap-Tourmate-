# Paeleap TourMate deployment gates

This repository ships a **restricted bilingual FAQ assistant**, not a general-purpose generative travel guide. The 100 answers are fixed data. Do not claim live prices, booking, timetables, routing or medically validated safety advice.

## Before deploying (required)

1. Use a dedicated Supabase project. Apply `supabase/schema.sql` and `supabase/faq-schema.sql` and then `supabase/faq-seed.sql`. Audit the RLS and function permissions in the deployed database.
2. For Miaoqu AI / DeepSeek V4 Pro, configure `AI_BASE_URL=https://api.miaoquai.com/v1`, `AI_MODEL=deepseek-v4-pro`, and a server-only `AI_API_KEY`. The adapter uses the Responses wire API at `/v1/responses` with `input`, `reasoning: {"effort":"none"}`, `text.format: {"type":"json_object"}` and `store:false`, retrying only explicit unsupported optional parameters. It selects a fixed FAQ ID, not arbitrary travel advice. Configure provider credentials: `AI_BASE_URL` (the HTTPS base URL ending in `/v1`; the server posts to `/responses`), `AI_API_KEY`, `AI_MODEL`. Confirm reachability and compatibility against the provider, including Chinese characters, rate-limited and malformed replies. Verify a signed-in end-to-end request through Miaoqu in staging; mock tests alone do not prove live availability.
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
Do not disable safety filtering or turn on arbitrary generative answers
to hide upstream failures. The current system selects FAQ IDs, not free-text
responses; a separate approved RAG implementation is required for open-ended
grounded answers.
