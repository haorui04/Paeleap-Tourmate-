# China-tourism FAQ bank

Exactly 100 question/answer pairs, each in English and Simplified Chinese, cover arrivals, payments, connectivity, transport, accommodation, food, sightseeing, planning, visitor needs and assistance (10 questions per category).

## How replies work

1. Validate input, authenticate where required and enforce the existing quota.
2. Apply rule-based safety checks. Emergency and blocked responses take priority.
3. Load the 100 records from the selected database.
4. Match the question. In AI mode, the provider sees the bank plus bounded conversation context and returns only an ID and confidence. The server accepts a known ID with confidence >=0.85. Offline mode uses normalized aliases and conservative weighted lexical/Chinese-bigram similarity; it is not a neural semantic model and recognizes fewer paraphrases.
5. Return the exact stored answer in the selected language, optional FAQ metadata and only that entry's official references. Existing output safeguards still apply if database content is unsafe.
6. If no reliable match exists, return the bilingual prompt to ask only about tourism in China (`safety.status=redirected`). A tourism question outside the bank is also redirected. Provider/database outages return an HTTP error rather than pretending a question was unrelated.

The model cannot supply arbitrary answer text to the client. Invalid JSON, invented IDs, low confidence and extra fields are rejected. Confidence is model-reported, not a guarantee of semantic accuracy; evaluate your chosen real provider before public launch. Deterministic safety checks are baseline heuristics, not comprehensive moderation.

## Ready-to-run local database

Default: `FAQ_BANK_SOURCE=local` (also used when unset).

Run from the project root with Node >=22.13:

```powershell
npm run faq:check
npm test
npm run dev
```

The actual SQLite database is `.paeleap/faq.sqlite`, excluded from Git. No SQLite package installation is required. Edit `data/china-tourism-faq.js` to change questions, translated answers or aliases, then run `npm run faq:check`. Do not reorder entries: stable IDs CN001–CN100 follow row order. The seed is authoritative; manual SQLite edits can be overwritten when the seed changes. Resync is transactional and affects only this FAQ database, never trip transcripts.

The server validates exactly 100 unique IDs and complete bilingual records. Local storage must be writable and persistent. If your host uses an ephemeral or read-only filesystem, select Supabase FAQ storage instead. Keep database/credential files out of public hosting and browser bundles.

## Optional Supabase FAQ database

This is independent of Supabase conversation history; existing chat tables and RLS are unchanged. No external database was configured or modified during this implementation.

1. Run `npm run faq:export` to generate `supabase/faq-seed.sql`.
2. Review and apply `supabase/faq-schema.sql` in your intended project's SQL editor, then apply the generated seed SQL. This upserts CN001–CN100; it does not delete unrelated rows. The API rejects banks with an unexpected row count, so use a dedicated table without extra IDs.
3. Set `FAQ_BANK_SOURCE=supabase`, `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` and restart the server. Never prefix the service key with `NEXT_PUBLIC_`.
4. Test `/api/chat`. The FAQ table is server-readable only; anonymous and authenticated browser access is revoked and RLS is enabled. Audit permissions and your existing project policies before deployment.

Seed changes require re-exporting and reapplying the seed for Supabase. There is no automatic upload or silent fallback to local data if remote storage fails.

## Enable AI semantic selection

Keep the FAQ database configuration and set real `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL`, plus `AI_MOCK_MODE=false`. Restart with `npm run dev`. With `ALLOW_LOCAL_DEMO=true`, the header shows Local AI; sign-in is still bypassed only for local development.

No real provider credentials are currently configured. Offline behavior, provider protocol and rejection parsing have automated tests; mocked provider tests do not establish real-world model accuracy. Production disables both local flags and also requires configured Supabase authentication/history.

## Content limitations

These are original, general visitor-oriented answers, not live policy, legal eligibility, medical advice, prices, timetables, weather or bookings. Visa and document questions refer users to responsible authorities, and venues/providers must confirm current requirements. Official reference links are attached only where they support the entry; uncited entries are general planning suggestions, not independently verified destination facts. Review the bank with a domain expert and refresh it before public use.

Suggested checks: `Can I pay using Alipay?` -> CN012; `高铁怎么买票？` -> CN031; `Tell me about West Lake` -> CN061. Unrelated questions such as arithmetic or an overseas itinerary should redirect. Safety prompts such as a medical emergency must retain their stronger safety response.
