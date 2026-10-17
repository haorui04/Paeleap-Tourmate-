# TourMate production readiness and frontend import

This is a **release-preparation branch**, NOT a production deployment. The uploaded frontend source is not yet present on GitHub's main branch. Do not merge until the full frontend is committed and deployment gates below pass.

## Required
1. Commit the hardened frontend ZIP contents into a feature branch. Exclude `.env.local`, `.paeleap/`, `.git/` and `node_modules/`. Use the clean artifact provided in the review conversation.
2. Use a dedicated Supabase project. Apply `supabase/schema.sql`, plus the frontend's `supabase/faq-schema.sql` and `supabase/faq-seed.sql`. Verify RLS and quotas.
3. Set production `FAQ_BANK_SOURCE=supabase`, `ALLOW_LOCAL_DEMO=false`, `AI_MOCK_MODE=false`. Local SQLite is not suitable for Vercel's ephemeral filesystem.
4. Add server-only `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`; browser `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` from the same project.
5. Run `npm ci`, `npm test`, `npm run build` and live auth/API/database tests in staging.
6. Verify bilingual high-risk prompts, FAQ source accuracy, privacy/retention disclosures, provider spend caps and Chinese network/regulatory requirements before opening public traffic.

## Safety of current feature
This commit adds an atomic per-user daily quota alongside the existing per-minute quota. It is **not** a full provider spending cap or independent AI safety validation.

The ChatGPT review environment passed 258 Node unit tests in the clean frontend source snapshot. The full Next.js build and live external integrations could not be verified because dependency registry access and dedicated Paeleap service configuration were unavailable.

**No real API keys are committed.**
