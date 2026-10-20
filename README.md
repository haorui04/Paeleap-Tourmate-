> **Production deployment:** Follow [DEPLOYMENT.md](DEPLOYMENT.md). Real provider and Supabase integration must be validated before enabling public traffic.

# Paeleap TourMate — integrated tourism chatbot

**Status:** frontend and backend are integrated on `feature/frontend-chat`. The chat endpoint now selects from exactly 100 bilingual China-tourism FAQs. Start with [START-HERE.md](START-HERE.md) for VS Code launch steps and [FAQ-BANK.md](FAQ-BANK.md) for database and matching details. No branch switch is required.

A bilingual Next.js application with a responsive chat interface, a local SQLite FAQ database for development (required Supabase FAQ storage in production), AI question selection, deterministic safety checks, persistent trip history, Supabase authentication, and a per-minute quota.

## Local setup

Requires Node.js 22.13 or newer, including built-in `node:sqlite` support.

```bash
npm ci
npm run dev
```

`package-lock.json` records the installed dependency versions. The local `.env.local` is set up for offline FAQ matching without external credentials. On a fresh checkout, copy `.env.example` to `.env.local`, or create it with the local flags below. Keep real credentials in `.env.local`, which Git ignores.

For a **local mock-only** smoke test, keep these variables in `.env.local`:

```env
ALLOW_LOCAL_DEMO=true
AI_MOCK_MODE=true
```

These modes are **automatically disabled in production**. Offline mode uses a conservative similarity matcher, not a live AI API. Both modes return only the selected database answer; an unrelated or unrecognized question receives the China-tourism-only prompt. Safety and emergency rules take priority. Each trip has its own sidebar entry, messages, draft and conversation ID. Browser storage keeps transcripts separated by account and restores them after reload. If only session storage works, the UI explains the limitation.

Local server context remains bounded to 30 minutes. If that context is missing after a restart, the local-only request can supply a bounded selection of earlier user/assistant messages. This optional `history` field is ignored in authenticated mode; signed-in context comes from the database. Local mode does not write to Supabase.

Saved browser history belongs to one browser profile and origin. `localhost`, `127.0.0.1` and different port numbers have separate storage. Return to the same URL to see your local trips. The old single-chat session is migrated automatically; chats that were already cleared by the old implementation cannot be recovered from local sample mode.

```bash
curl http://localhost:3000/api/status

curl -s -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"How do I book a train ticket in China?","language":"en"}'
```

For semantic AI matching, configure `AI_BASE_URL`, `AI_API_KEY`, and `AI_MODEL`, set `AI_MOCK_MODE=false`, and test the provider's **configured direct POST URL** (`https://api.miaoquai.com/v1` for Miaoqu). This code does not append `/chat/completions`. The model returns an FAQ ID and confidence, not free-form answers. The server requires a known ID and confidence of at least 0.85, then looks up the stored answer. Providers with a different protocol require an adapter. Do not publish secrets or send them to the browser.

## Database setup

There was no clearly identified Supabase project for this application on 2026-10-15. **No live schema has been applied.**

1. Create a dedicated Supabase project for this chatbot.
2. Run `supabase/schema.sql` in its SQL editor (or prepare and apply a migration with your team's CLI process).
3. Use that project's URL and publishable key for `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`.
4. Set `SUPABASE_SERVICE_ROLE_KEY` to the server-only **legacy service_role JWT** for the project. Never expose this to client code or commit it.
5. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` for the browser to the same project URL and publishable key. Enable email/password authentication and configure your application's URL in Supabase Auth.
6. Set `ALLOW_LOCAL_DEMO=false`, restart the app, and sign in through the frontend. Set `AI_MOCK_MODE=false` and supply real provider credentials for live AI responses.

The chat server validates the caller against Supabase Auth, verifies conversation ownership under RLS, loads the most recent 12 messages, atomically consumes one per-user per-minute quota slot (6/minute), and writes user/assistant messages through its server-only service-role client. Browser clients have no direct message INSERT policy.

**Database security note:** deploy only after verifying RLS, permissions, Auth and quotas on the selected project. Rate limits also need project-wide daily spending controls for a public launch.

## Integration contract — frontend teammate

**POST `/api/chat`**

Headers:

```http
Content-Type: application/json
Authorization: Bearer <supabase_access_token>
```

Request:

```json
{
  "conversationId": null,
  "message": "What is West Lake and why is it culturally significant?",
  "language": "en"
}
```

For the first message omit `conversationId` or set it to `null`. Reuse the returned UUID on later messages. Language accepts `en` or `zh`.

Successful response (example; not guaranteed text):

```json
{
  "reply": "West Lake in Hangzhou is a UNESCO-listed cultural landscape...",
  "conversationId": "550e8400-e29b-41d4-a716-446655440000",
  "sources": [{"name":"West Lake","url":"https://whc.unesco.org/en/list/1334"}],
  "safety": {"status": "allowed"},
  "faq": {"id":"CN061","question":"What is West Lake and why is it culturally significant?","category":"sightseeing"}
}
```

The optional `faq` field is present only for an allowed database answer. No match returns `redirected`, no sources and no FAQ metadata. Existing clients that ignore `faq` remain compatible. Safety statuses: `allowed`, `blocked`, `emergency`, `redirected`, `sanitized`. Possible HTTP errors: 400 invalid input, 401 invalid/missing auth, 404 conversation not owned/found, 413 oversize input, 429 rate limit, 502 provider failure, 503 server/database unavailable or unconfigured, 504 timeout.

To send user credentials from the frontend, get a valid Supabase session access token using the frontend auth SDK; **never** send the service-role key. The frontend can display `sources` as verified reference links. Do not claim that sources prove live opening hours or pricing.

**GET `/api/status`** returns non-sensitive booleans describing configuration. It does not ping third-party services.

`localDemoMode` describes the local authentication bypass; `aiMockMode` describes offline versus AI matching. `faqBank` reports configured source, expected count and matching mode, not database health. These are separate settings. Configuration flags reject example placeholders, but do not establish that external services are reachable.

## Components

- `app/page.jsx`, `app/layout.jsx`, `app/globals.css` — root page and responsive visual shell.
- `components/ChatShell.jsx` — bilingual chat, conversation state, cancellation, errors and verified reference links.
- `components/useTripHistory.js` — separate trip tabs, persistent browser history, drafts and authenticated cloud history loading.
- `components/AuthPanel.jsx` — Supabase account creation and sign-in.
- `lib/client/` — browser Auth client and validated chat contract.
- `postcss.config.mjs` — Tailwind CSS integration for responsive layout utilities.
- `next.config.mjs` — anchors Next.js to this project, avoiding unrelated ancestor lockfiles.

- `app/api/chat/route.js` — validated bilingual chat API.
- `lib/ai/provider.js` — semantic FAQ classifier, strict ID parser and bounded context.
- `lib/ai/safety.js` — rule-based input checks and conservative output safeguards.
- `lib/tourism/faq-matching.js` — conservative offline matcher and bilingual no-match prompt.
- `data/china-tourism-faq.js` — editable seed, exactly 100 bilingual questions/answers.
- `lib/db/faq.js` — SQLite seed/read validation and optional server-only Supabase FAQ reads.
- `scripts/faq-bank.mjs` — initialize/check SQLite and export the Supabase seed.
- `supabase/faq-schema.sql`, generated `supabase/faq-seed.sql` — optional remote FAQ setup.
- `lib/tourism/retrieval.js`, `data/attractions.js` — legacy attraction reference utilities; no longer the chat reply path.
- `lib/db/supabase.js` — authenticated REST reads, server-side writes and quota.
- `supabase/schema.sql` — SQL schema and RLS.
- `tests/` — Node's built-in test runner.

## Test

```bash
npm test
npm run build
```

The automated suite includes authenticated API contract checks with simulated external services, ownership, quotas, safety statuses, provider errors, local context reuse, and frontend response validation. These tests do not replace a live test against your actual provider and Supabase project.

Trip-history tests also cover migration, keeping more than forty messages, restoring timestamps and references, account-specific storage, paginated cloud reads and safe local context. The UI development checklist and remaining Git publication limitations are documented in `UI-CHECKLIST.md`.

## Known limits and Day 2 handoff

- The 100-question bank is general guidance, not live policy, prices, availability, weather, route or booking data. Questions outside it are redirected, even if they involve tourism.
- SQLite needs a writable persistent project directory. Use the Supabase FAQ option for deployments with ephemeral/read-only disks; never silently fall back when the selected database fails.
- Prompt-injection and harmful-content checks are baseline heuristics, **not** a comprehensive safety guarantee.
- Output validation is intentionally conservative; some useful timetable-like suggestions may be replaced with a verification warning.
- Cross-device history requires configured Supabase. Local transcripts persist in browser storage until that storage is cleared; local server context is temporary.
- Provider authentication and database schema require credentials and deployment configuration.
- Real provider responses and live Supabase sign-in require credentials that have not been supplied in this project.
- No production deployment has been performed yet.

**Next:** configure the real provider and dedicated database, then verify live authentication, RLS, provider behavior and spending controls before a public launch.
