# Paeleap TourMate deployment gates

This repository ships a **restricted bilingual FAQ assistant**, not a general-purpose generative travel guide. The 100 answers are fixed data. Do not claim live prices, booking, timetables, routing or medically validated safety advice.

## Before deploying (required)

1. Use a dedicated Supabase project. Apply `supabase/schema.sql` and `supabase/faq-schema.sql` and then `supabase/faq-seed.sql`. Audit the RLS and function permissions in the deployed database.
2. Configure provider credentials: `AI_BASE_URL` (HTTPS Chat Completions), `AI_API_KEY`, `AI_MODEL`. Confirm reachability and compatibility against the provider, including Chinese characters, rate-limited and malformed replies.
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
