# Museum companions: setup, integration and release

## What this version delivers

One application can host up to 100 published museum profiles, in addition to the built-in TourMate. Each profile has a fixed bilingual name, venue, role description, greeting, tone, scope and its own question/answer knowledge. Administrators upload one JSON file at `/admin`; visitors open `/?persona=<id>`. This is deployment-wide administration, not separate organization-specific RBAC.

The platform safety policy is immutable from persona files or visitor prompts. Persona descriptions are structured configuration, not an arbitrary privileged prompt editor. Tone has three supported presets: professional, warm and child-friendly. Visitors cannot add persistent nicknames/sign-offs, change the role, remove required provenance or request fiction-style historical accounts. The interface can switch between English and Chinese without changing identity.

Generic museum profiles select and combine up to three approved records, rendered by the server. The researched `little-de-rabbit` profile now has a separate DeepSeek explanation flow with validated structured output and source IDs; see [Deshou knowledge and response flow](deshou-museum.md). Its homepage is the default museum experience. The generic evidence-only flow remains available for other profiles. Neither flow proves semantic correctness or makes incorrect reference content true.

## 1. Configure a private staging deployment

1. Install Node 22.13+ and run `npm ci` from the project folder.
2. Copy `.env.example` to a gitignored `.env.local` for local development, or use encrypted environment variables on your host. Never commit actual keys.
3. Configure one dedicated Supabase project's server URL, publishable key and service-role key, plus its matching browser-safe `NEXT_PUBLIC_SUPABASE_*` values.
4. For a **new** database, apply `supabase/schema.sql`, `supabase/faq-schema.sql`, and `supabase/faq-seed.sql`. For an existing database, back it up and review the migration state first; old policy creation is not designed to be rerun blindly.
5. Apply `supabase/personas-schema.sql`, then `supabase/conversation-personas.sql`, then `supabase/quota-hardening.sql`. These add immutable packages, public-metadata projection, version publication, profile-bound transactional message writes and explicit invalid-quota-argument rejection. They are not applied automatically by a build or a GitHub push.
6. Set `FAQ_BANK_SOURCE=supabase` for production. Refresh the FAQ seed to obtain the reviewed safety-reporting paraphrases; the canonical 100 answers remain unchanged.
7. Create or select a Supabase Auth administrator account using your normal approved account process. Add its **user UUID** to server-only `PERSONA_ADMIN_USER_IDS`. Empty disables publishing; request fields and editable user metadata never grant administrator access.
8. Configure your provider key, exact supported model, `/v1` base URL and explicit `AI_API_STYLE`. `npm run ai:check` checks basic provider reachability only; it does not evaluate safety. Test the actual signed-in chat in staging.
9. Set `ALLOW_LOCAL_DEMO=false`, `AI_MOCK_MODE=false`, `PERSONA_LOAD_EXAMPLES=false`. Production ignores the demo/mock flags even if accidentally enabled. Select `AI_RESPONSE_MODE=grounded` for TourMate evidence composition, or `faq` for single-record FAQ selection. Custom museums use evidence composition.

Provider-side limits are required: 384 output tokens for FAQ selection, 512 for evidence composition, plus timeouts and a 128-KiB gateway-envelope bound. A provider rejecting these limits degrades safely; the application does not silently remove caps or change providers. Confirm these fields with your actual gateway.

## 2. Prepare and publish a museum

1. Copy [`little-de-rabbit.json`](../examples/personas/little-de-rabbit.json) as a starting template. Its three entries are **demonstrations**, not real De Shou exhibition content or official affiliation.
2. Set a unique slug, version `1`, both-language identity/role/greeting and an appropriate tone. Describe the actual scope. Do not claim official status without the venue's approval.
3. Replace the knowledge with curator-reviewed bilingual records. Clearly distinguish history, interpretation and legend. Include authoritative reference links where available. Do not include private visitor data, internal credentials or instructions to bypass platform controls.
4. Keep each question within 500 characters and each answer within 1,600. Split long documents into focused question/answer records; maximum 2,000 records and a 2-MiB incoming file. See [the complete schema](../examples/personas/README.md).
5. Sign in at `/admin`, select the JSON file, review the preview, confirm the content review and publish. The API independently validates the file and administrator's verified identity; browser previews are not authorization.
6. Open `/?persona=your-museum-id`, test both languages, references, unsupported questions and all relevant accessibility/emergency cases. The greeting/identity response comes directly from the published persona, not a model's preferred identity.
7. To revise content, publish the same slug at exactly the next version. Stale/concurrent versions return 409. Existing conversations cannot silently switch knowledge versions: they remain readable but further messages against a changed profile require a new trip. No history is deleted.

Publication is append-only for auditability. To respond to an incident, set server-only `PERSONA_DISABLED_IDS=your-museum-id` and redeploy/reload the environment. That profile disappears from the public catalogue and chat fails closed before its knowledge/history/provider work. Administrators can still inspect and publish a repaired version. Remove the disable setting only after review. Malformed disable configuration fails closed rather than being ignored.

## 3. Integrate with an existing museum system

The ready-to-use visitor interface is `https://<your-host>/?persona=<id>`. For an existing frontend or mobile application, use the authenticated API instead:

```http
GET /api/personas?id=little-de-rabbit
```

This returns public name, venue, greeting, tone and version only—not the private role description, full knowledge or other visitors' data.

```http
POST /api/chat
Content-Type: application/json
Authorization: Bearer <visitor's Supabase access token>

{"personaId":"little-de-rabbit","conversationId":null,"language":"zh","message":"开放时间和票价是多少？"}
```

Reuse the returned conversation UUID and same persona ID for subsequent messages. The server chooses the current published version, checks ownership/version before reading context, ignores visitor-supplied roles/system instructions/history in authenticated mode, and writes the exchange through a transaction that rechecks the binding. Unknown profiles return 404; version/profile conflicts return 409. Other errors retain the existing contract.

The response includes `reply`, `conversationId`, `sources`, `safety.status`, public `persona`, and `ai.mode`:

| Mode | Meaning |
| --- | --- |
| `persona_identity` | Public administrator-configured greeting/identity; no model call |
| `curated_faq` | One stored answer selected from the profile's bank |
| `curated_faq_fallback` | Provider unavailable/invalid; deterministic approved-answer fallback |
| `curated_evidence` | Small reviewed multi-topic TourMate planning composition; no model call |
| `evidence_composition` | Model-selected approved record composition; no unchecked model prose |

Sources are administrator-supplied references for selected records, not proof of independent/live verification. Never label them as guaranteeing current opening hours, visa eligibility, prices or bookings.

For CMS integration, export reviewed content into the JSON schema and send it from an authenticated administrator session to `POST /api/admin/personas` as the raw JSON body. `GET /api/admin/personas` returns full latest packages only to allowlisted administrators. Browser administration is same-origin only. The repository does not contain an arbitrary webpage/PDF crawler, third-party SSO bridge or anonymous public chat gateway. Reference URLs are displayed but **never automatically fetched**; a database URL alone is not ingested knowledge. Use your backend/reverse proxy for cross-system integration rather than exposing the service-role key or enabling wildcard CORS. Framing is denied by default; a link or API integration works without weakening that protection.

## 4. Verify before public release

Run `npm run test:syntax`, `npm test`, `npm run test:remediation -- --strict --out reports/remediation.json`, `npm audit --audit-level=high`, and `npm run build`. Preserve the raw prompt/output evidence, source hashes, timestamps and scenario labels. The retained corpus is known regression data, not a new independent sample.

The local database-engine tests execute real PostgreSQL-in-WASM SQL with emulated Supabase roles; API fixtures simulate services. Neither replaces validation on the actual hosted project.

Required launch gates: actual-model repeated multilingual adversarial evaluation with unseen prompts; two-account hosted RLS/isolation tests; concurrent publication/quota tests; real admin upload/version rollback exercise; browser/mobile/accessibility checks in your target environments; TLS, edge abuse controls, provider hard spend caps, monitoring and incident ownership. Review knowledge accuracy, source permissions, privacy notices, transcript retention/deletion, data location and applicable Chinese legal/regulatory obligations with responsible specialists. The code does not independently certify legal compliance or eliminate all abuse.

Signed-in transcripts are stored in Supabase; local demo transcripts stay in browser storage. Redaction reduces selected personal-data formats sent to the provider but is not complete DLP, and raw user text may still be persisted. Do not invite visitors to submit passports, payment credentials or other sensitive identifiers.
