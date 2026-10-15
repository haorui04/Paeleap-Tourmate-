# Paeleap Tourism Assistant — backend Day 1

**Status:** backend prototype committed on `feature/ai-backend-day1`. The frontend and production service configuration are separate workstreams.

A bilingual, tourism-focused Next.js Route Handler with an OpenAI-compatible model adapter, curated Hangzhou heritage references, deterministic safety checks, conversation storage, Supabase Auth checks, and per-minute database quota.

## Local setup

Requires Node.js 22+ (Next.js 16).

```bash
git checkout feature/ai-backend-day1
npm install
cp .env.example .env.local
npm run dev
```

Generate and commit `package-lock.json` after `npm install` on a machine with registry access, then use `npm ci` in CI. The initial repository bootstrap could not download registry packages in the authoring environment.

For a **local mock-only** smoke test, keep these variables in `.env.local`:

```env
ALLOW_LOCAL_DEMO=true
AI_MOCK_MODE=true
```

These modes are **automatically disabled in production**. Mock responses use curated data, not an AI API, and demo conversations are not persisted. They are intended only for frontend development.

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
5. Configure Supabase Auth in the frontend, then set `ALLOW_LOCAL_DEMO=false`.

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

## Components

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

Before running the live demo, test both languages, auth ownership, 30 safety prompts, API errors, high concurrency, and provider cost limits. The project currently has automated unit/contract smoke tests, **not** a completed 30-case field evaluation.

## Known limits and Day 2 handoff

- Static knowledge covers four Hangzhou heritage entries and is not live route or booking data.
- Prompt-injection and harmful-content checks are baseline heuristics, **not** a comprehensive safety guarantee.
- Output validation is intentionally conservative; some useful timetable-like suggestions may be replaced with a verification warning.
- Chat history is stored only with configured Supabase; local demo has no persistence.
- Provider authentication and database schema require credentials and deployment configuration.
- The frontend page is a placeholder and is owned by the teammate.
- No production deployment has been performed yet.

**Day 2:** connect the real provider and dedicated database, test live auth and RLS, pair 30 unguarded/guarded safety cases, add monitoring/cost budgets, and integrate frontend pull requests.
