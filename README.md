# Paeleap TourMate — integrated tourism chatbot

**Status:** the frontend and backend are integrated on the current `main` checkout. Start with [START-HERE.md](START-HERE.md) for the exact VS Code launch steps. The backend branch has already been merged; there is no need to switch branches.

A bilingual Next.js application with a responsive chat interface, Supabase email authentication, an OpenAI-compatible model adapter, curated Hangzhou heritage references, deterministic safety checks, conversation storage, and a per-minute database quota.

## Local setup

Requires Node.js 22+ (Next.js 16).

```bash
npm ci
npm run dev
```

`package-lock.json` now records the installed dependency versions. The local `.env.local` file is already set up for sample responses without external credentials. On a fresh checkout, copy `.env.example` to `.env.local`, or create `.env.local` with the two local flags below. Keep all real credentials in `.env.local`, which Git ignores.

For a **local mock-only** smoke test, keep these variables in `.env.local`:

```env
ALLOW_LOCAL_DEMO=true
AI_MOCK_MODE=true
```

These modes are **automatically disabled in production**. Mock responses use curated data, not an AI API. Each trip has its own sidebar entry, messages, draft and conversation ID. The browser saves all trip transcripts in local storage, separated by account, and restores them after reload or a browser restart. If only session storage is available, it is used as a fallback and the UI explains the persistence limitation.

Local server context remains bounded to 30 minutes. If that context is missing after a restart, the local-only request can supply a bounded selection of earlier user/assistant messages. This optional `history` field is ignored in authenticated mode; signed-in context comes from the database. Local mode does not write to Supabase.

Saved browser history belongs to one browser profile and origin. `localhost`, `127.0.0.1` and different port numbers have separate storage. Return to the same URL to see your local trips. The old single-chat session is migrated automatically; chats that were already cleared by the old implementation cannot be recovered from local sample mode.

```bash
curl http://localhost:3000/api/status

curl -s -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"Plan a day in Hangzhou","language":"en"}'
```

For actual AI responses, configure `AI_BASE_URL`, `AI_API_KEY`, and `AI_MODEL`, set `AI_MOCK_MODE=false`, and test the provider's **OpenAI-compatible Chat Completions** API. Providers with a different protocol require an adapter. Do not publish secrets or send them to the browser.

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
  "message": "Plan a day in Hangzhou",
  "language": "en"
}
```

For the first message omit `conversationId` or set it to `null`. Reuse the returned UUID on later messages. Language accepts `en` or `zh`.

Successful response (example; not guaranteed text):

```json
{
  "reply": "Here are attractions from verified sources: ...",
  "conversationId": "550e8400-e29b-41d4-a716-446655440000",
  "sources": [{"name":"West Lake","url":"https://whc.unesco.org/en/list/1334"}],
  "safety": {"status": "allowed"}
}
```

Safety statuses: `allowed`, `blocked`, `emergency`, `redirected`, `sanitized`. Possible HTTP errors: 400 invalid input, 401 invalid/missing auth, 404 conversation not owned/found, 413 oversize input, 429 rate limit, 502 provider failure, 503 server unavailable or unconfigured, 504 timeout.

To send user credentials from the frontend, get a valid Supabase session access token using the frontend auth SDK; **never** send the service-role key. The frontend can display `sources` as verified reference links. Do not claim that sources prove live opening hours or pricing.

**GET `/api/status`** returns non-sensitive booleans describing configuration. It does not ping third-party services.

`localDemoMode` describes the local authentication bypass, and `aiMockMode` describes whether answers use curated sample data. They are separate flags. Configuration flags reject example placeholders, but do not establish that external services are reachable.

## Components

- `app/page.jsx`, `app/layout.jsx`, `app/globals.css` — root page and responsive visual shell.
- `components/ChatShell.jsx` — bilingual chat, conversation state, cancellation, errors and verified reference links.
- `components/useTripHistory.js` — separate trip tabs, persistent browser history, drafts and authenticated cloud history loading.
- `components/AuthPanel.jsx` — Supabase account creation and sign-in.
- `lib/client/` — browser Auth client and validated chat contract.
- `postcss.config.mjs` — Tailwind CSS integration for responsive layout utilities.
- `next.config.mjs` — anchors Next.js to this project, avoiding unrelated ancestor lockfiles.

- `app/api/chat/route.js` — validated bilingual chat API.
- `lib/ai/provider.js` — configurable LLM adapter, context assembly, local mock.
- `lib/ai/safety.js` — rule-based input checks and conservative output safeguards.
- `lib/tourism/retrieval.js` — simple English/Chinese knowledge lookup.
- `data/attractions.js` — initial UNESCO-grounded static pilot dataset.
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

- Static knowledge covers four Hangzhou heritage entries and is not live route or booking data.
- Prompt-injection and harmful-content checks are baseline heuristics, **not** a comprehensive safety guarantee.
- Output validation is intentionally conservative; some useful timetable-like suggestions may be replaced with a verification warning.
- Cross-device history requires configured Supabase. Local transcripts persist in browser storage until that storage is cleared; local server context is temporary.
- Provider authentication and database schema require credentials and deployment configuration.
- Real provider responses and live Supabase sign-in require credentials that have not been supplied in this project.
- No production deployment has been performed yet.

**Next:** configure the real provider and dedicated database, then verify live authentication, RLS, provider behavior and spending controls before a public launch.
