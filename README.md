> **Production deployment:** Follow [DEPLOYMENT.md](DEPLOYMENT.md). Real provider and Supabase integration must be validated before enabling public traffic.
>
> **Safety testing:** [SECURITY-TESTING.md](SECURITY-TESTING.md) documents adversarial prompts, red/blue-team defenses, reproducible evidence and mandatory live-provider/database launch gates. Passing offline fixtures is not production safety certification.

# Tourmate — 小德兔 Museum AI Companion

**Current focus:** the homepage opens Little De Rabbit / 小德兔, an independent AI companion for Hangzhou's Southern Song Deshou Palace Ruins Museum. It uses a versioned Supabase persona with 24 bilingual research records and DeepSeek-authored explanations. See [museum knowledge, response flow and limitations](docs/deshou-museum.md). Knowledge is reference context, not model training. Existing China-travel data and conversations remain available through `/?persona=tourmate`. A passing build is not public-launch certification.

A bilingual Next.js application with a responsive chat interface, a local SQLite FAQ database for development (required Supabase FAQ storage in production), AI question selection, deterministic safety checks, persistent trip history, Supabase authentication, and a per-minute quota.

The white-and-blue travel interface includes reduced-motion-aware response animations and confirmed chat deletion. Deleting a saved trip removes its conversation/messages from Supabase and clears the browser copy. See [UI and deletion behavior](docs/UI-AND-CHAT-DELETION.md).

TourMate also supports [travel image and document attachments](docs/TRAVEL-ATTACHMENTS.md): images, PDFs, DOCX, TXT and Markdown. Image/PDF perception uses a separately configured vision model; DeepSeek remains the main answer model. Files are request-only references and do not train or change the persona.

Little De Rabbit also supports [museum artifact identification from images, labels and document descriptions](docs/MUSEUM-ATTACHMENTS.md). It checks museum records first, compares uncertain images with curated reference photographs, then uses public Wikimedia Commons keyword image search for naming hints, without a separate search API key. This is narrower than whole-web reverse image search; existing AI calls still consume provider usage. Matches remain tentative and tied to the museum's published references. Labels are optional; an unmatched image does not prove absence from the museum. Setup and photographic coverage are documented at that link. Raw files are not saved in Supabase.

## Local setup

Requires Node.js 22.13 or newer, including built-in `node:sqlite` support.

```bash
npm ci
npm run dev
```

`package-lock.json` records dependency versions. No real credentials are supplied. On a fresh checkout, copy `.env.example` to `.env.local`, then configure it. Keep real credentials in `.env.local`, which Git ignores.

For a **local mock-only** smoke test, keep these variables in `.env.local`:

```env
ALLOW_LOCAL_DEMO=true
AI_MOCK_MODE=true
FAQ_BANK_SOURCE=local
# Enable the researched Little De Rabbit package for local development:
PERSONA_LOAD_EXAMPLES=true
```

These modes are **automatically disabled in production**. Offline mode uses a conservative similarity matcher, not a live AI API, and returns stored reference answers. Production museum mode reads the published Supabase package and generates explanations with the configured model. Safety and emergency rules take priority. Each conversation has its own sidebar entry, messages, draft and conversation ID. Browser storage keeps transcripts separated by account and persona, and restores them after reload. If only session storage works, the UI explains the limitation.

Local server context remains bounded to 30 minutes. If that context is missing after a restart, the local-only request can supply a bounded selection of earlier user/assistant messages. This optional `history` field is ignored in authenticated mode; signed-in context comes from the database. Local mode does not write to Supabase.

Saved browser history belongs to one browser profile and origin. `localhost`, `127.0.0.1` and different port numbers have separate storage. Return to the same URL to see your local trips. The old single-chat session is migrated automatically; chats that were already cleared by the old implementation cannot be recovered from local sample mode.

```bash
curl http://localhost:3000/api/status

curl -s -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"How do I book a train ticket in China?","language":"en"}'
```

For semantic AI matching, configure the server-only provider key, exact `AI_MODEL`, `AI_BASE_URL` ending in `/v1`, and explicit `AI_API_STYLE=responses|chat_completions|anthropic`. The adapter appends the protocol's inference path. Set `AI_MOCK_MODE=false`. `AI_RESPONSE_MODE=faq` preserves single-FAQ selection; `grounded` and custom museum profiles select and render approved records. **For AI-written TourMate responses, set `AI_RESPONSE_MODE=generated`**: relevant FAQs are optional references, while safe general travel guidance can also use the model's existing knowledge. This is reference retrieval, not model training or fine-tuning. The example configuration uses `deepseek/deepseek-v3.1` through Vercel AI Gateway with the Chat Completions protocol. See [generated-answer setup and limits](docs/GENERATED-ANSWERS.md). Source links come only from cited records; general guidance, fallback answers and clarifications have separate provenance labels. A successful HTTP response or `/api/status` alone does not prove successful inference.

## Database setup

**Live weather:** TourMate supports compact current conditions (place, weather, temperature, humidity and query time) and a three-day city forecast starting today. Try `What is the weather in Shanghai tommorow?`, `Shanghai weather over the next few days` or `上海明天的天气`. Authentication, quotas and input/persona checks apply before lookup. Source credit stays in a collapsible reference area; outages never fall back to invented model weather. See [configuration, security and commercial-use requirements](docs/LIVE-WEATHER.md).

There was no clearly identified Supabase project for this application on 2026-10-15. **No live schema has been applied.**

1. Create a dedicated Supabase project for this chatbot.
2. For a new database apply `supabase/schema.sql`, `supabase/faq-schema.sql`, `supabase/personas-schema.sql`, `supabase/conversation-personas.sql`, `supabase/quota-hardening.sql`, then `supabase/knowledge-schema.sql`, `supabase/faq-seed-v2.sql` and `supabase/planning-seed.sql`. Existing installations need only the knowledge migration and its new seeds after verification; retain the legacy `tourism_faq` bank for rollback. Do not rerun old policy creation blindly.
3. Use that project's URL and publishable key for `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`.
4. Set `SUPABASE_SERVICE_ROLE_KEY` to the server-only **legacy service_role JWT** for the project. Never expose this to client code or commit it.
5. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` for the browser to the same project URL and publishable key. Enable email/password authentication and configure your application's URL in Supabase Auth.
6. Set `ALLOW_LOCAL_DEMO=false`, restart the app, and sign in through the frontend. Set `AI_MOCK_MODE=false` and supply real provider credentials for live AI responses.

The chat server validates Supabase Auth, checks owner and immutable persona/version binding before reading context, loads the most recent 12 messages, and consumes atomic 6/minute and 60/day quotas. The service-only `store_persona_exchange` RPC rechecks owner/profile/version under a row lock and writes both turns atomically. Browser clients cannot insert messages or publish persona packages directly.

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
  "language": "en",
  "personaId": "tourmate"
}
```

For the first message omit `conversationId` or set it to `null`. Reuse the returned UUID and same `personaId` on later messages. Language accepts `en` or `zh`. `personaId` defaults to `tourmate`. A profile/version mismatch returns 409 and requires a new trip; old history remains saved. The response also includes public `persona` identity and `ai.mode` (`curated_faq`, `curated_faq_fallback`, `evidence_composition`, or `persona_identity`).

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

Use a valid Supabase session access token; **never** send the service-role key. Display sources as administrator-supplied references, not independently verified facts or live data. The application does not browse citation URLs.

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
- `data/china-tourism-faq.js`, `data/china-tourism-faq-expanded.json` — original 100 plus 900 additional bilingual FAQs.
- `data/travel-destinations.json`, `data/travel-itinerary-routes.json` — destination profiles and original route suggestions.
- `data/travel-knowledge-sources.json` — labelled research-discovery catalogue; see evidence-scope limitations.
- `lib/db/planning.js` — bounded server-only destination retrieval for TourMate planning requests.
- `lib/db/faq.js` — SQLite seed/read validation and optional server-only Supabase FAQ reads.
- `scripts/faq-bank.mjs` — initialize/check SQLite and export the Supabase seed.
- `supabase/knowledge-schema.sql`, `supabase/faq-seed-v2.sql`, `supabase/planning-seed.sql` — versioned FAQ and separate planning tables/seeds.
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

- The expanded knowledge libraries are general guidance and suggested plans, not live policy, fares, schedules, availability or confirmed bookings. Generated mode can provide safe general travel answers beyond the bank. Only the dedicated weather tool supplies live weather; the model must not invent current conditions.
- SQLite needs a writable persistent project directory. Use the Supabase FAQ option for deployments with ephemeral/read-only disks; never silently fall back when the selected database fails.
- Prompt-injection and harmful-content checks are baseline heuristics, **not** a comprehensive safety guarantee.
- Output validation is intentionally conservative; some useful timetable-like suggestions may be replaced with a verification warning.
- Cross-device history requires configured Supabase. Local transcripts persist in browser storage until that storage is cleared; local server context is temporary.
- Provider authentication and database schema require credentials and deployment configuration.
- Real provider responses and live Supabase sign-in require private deployment credentials. Never commit those keys in the repository.

Before a public launch, review the published guidance, authentication, RLS, live provider behavior and spending controls in the intended deployment.
