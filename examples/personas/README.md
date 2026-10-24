# Museum persona packages

`little-de-rabbit.json` is a **demonstration configuration**, not an official De Shou Palace knowledge base. It deliberately does not invent exhibition facts, opening hours, prices, booking links or official affiliation. Replace the demonstration entries with content approved by the venue before publication.

## Package format

Each UTF-8 JSON file combines one fixed visitor-facing persona and its associated knowledge. Required fields are:

| Field | Format / limit |
| --- | --- |
| `id` | Lowercase slug, 2–64 characters; start with a letter; `tourmate` is reserved |
| `version` | Positive integer; initial publication is `1`, next publication is exactly previous + 1 |
| `name`, `venue`, `role`, `greeting` | Objects containing both `en` and `zh` strings |
| `tone` | `professional`, `warm` or `child_friendly` |
| `scope` | 1–20 short approved topics; include both languages where appropriate |
| `knowledge` | 1–2,000 records; unique IDs and questions |

Each knowledge record contains `id`, `question_en`, `question_zh`, `answer_en`, `answer_zh` and `sources`. Each source is `{ "name": "Publication title", "url": "https://public.example.org/page" }`. Supply actual publicly accessible sources, not the illustrative domain. Up to six sources per record are supported; an empty list is permitted for administrator-reviewed venue information.

Maximum upload size is **2 MB**. Question text is at most 500 characters, each answer 1,600, role descriptions 1,600 per language, greetings 800, names 80 and venue labels 160. Split longer knowledge into focused question/answer records; this permits a response to combine up to three reviewed records within the application's 6,000-character message limit. Unknown fields, duplicate IDs/questions, obvious prompt overrides and recognizable credentials are rejected. These checks do not replace curator review or semantic safety evaluation.

The platform safety policy is separate and is not replaceable through a persona file. A `role` describes the museum companion; it is not a system-prompt override. Do not place private visitor records, personal data, passwords or API keys in a package.

## Local demonstration

Set `PERSONA_LOAD_EXAMPLES=true` in the local, gitignored environment file. The supplied example is then available alongside TourMate. This switch is ignored in production. It does not publish a package to a database or turn the example into an official museum service.

## Persistent publication

1. In a staging Supabase project, apply the existing `supabase/schema.sql`, then `supabase/personas-schema.sql`, then `supabase/conversation-personas.sql`. The new migrations are not automatically applied by the application.
2. Configure the server's Supabase URL, publishable key and service-role key. Never put the service-role key in browser code, a persona file or GitHub.
3. Add the administrator's **verified Supabase Auth user UUID** to server-only `PERSONA_ADMIN_USER_IDS`. Multiple UUIDs may be comma-separated. No configured administrator means publication is disabled; editable user metadata cannot grant administrator privileges.
4. Sign in as that administrator. Send the package as the raw JSON body of `POST /api/admin/personas`, with `Authorization: Bearer <Supabase access token>` and `Content-Type: application/json`. An admin UI may make the same request. Browser administration is same-origin only.
5. A successful publication returns HTTP 201 and `{ "persona": <published package> }`. A competing or stale version returns HTTP 409; reload the latest version and review changes before incrementing the version. Never silently retry with a different version.

Published versions are append-only. Each conversation remains bound to its initial persona ID and version, so changing a knowledge base must not silently change existing conversations. New conversations can select the latest published version. The service-role-only message-write RPC rechecks owner, persona ID and version under a row lock before writing both turns atomically.

`GET /api/personas` returns only public identity/greeting metadata. `GET /api/personas?id=<slug>` returns one public profile. It never returns the private role description or knowledge text. The authenticated administrative `GET /api/admin/personas` returns the latest full packages. Up to 100 custom personas are supported per deployment.

## Knowledge links and verification limits

Source URLs are **references, not automatic imports**. The importer does not browse URLs, run scripts, read arbitrary filesystem paths or call tools specified in knowledge text. Private/local addresses, IP literals, credential-bearing links and non-HTTPS links are rejected. For an existing CMS or knowledge service, have an authenticated administrative integration export reviewed records into this schema. An arbitrary URL is not proof that the application has read its contents.

Before a public launch, verify actual Supabase RLS/grants, concurrent version publication, ownership checks, model behavior and venue content in staging. Local fixtures and static SQL checks do not prove a live database deployment is correctly configured.
