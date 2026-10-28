# Tourmate museum companion: Little De Rabbit / 小德兔

The public homepage opens `little-de-rabbit`, an independent AI guide to Hangzhou's Southern Song Deshou Palace Ruins Museum. It does not claim museum endorsement. The old travel profile and its conversations remain under `/?persona=tourmate`. Each conversation keeps its persona ID and immutable published version; existing conversations are not relabeled.

## Knowledge and provenance

`data/personas/deshou-palace.js` contains a bilingual persona and 24 original summary records, researched on 2026-10-28. Eight source pages are cited per record. Coverage includes documented celadon vessels, Jian bowls, gaming pieces, architectural remains, reconstructed furnishings, digital interpretation and visitor-information limits. This is a selected research package, **not a complete accession catalogue or a curator-certified inventory**.

The source publisher and publication date are included in citation names. A 2022 opening report establishes a historical exhibition, not today's display. A September 2026 report supports more recent highlights. The 2025 architecture exhibition is explicitly a past event. Sources about another institution's objects are labeled as general context, not evidence that those objects belong to Deshou. No web images or long copied source articles are imported.

Export an administrator-uploadable JSON file with `node scripts/museum-export.mjs little-de-rabbit-v1.json`. The file is validated by the same strict schema used for server publication. Administrators can publish revised packages through `/admin`; increment the version and supply the expected previous version. Keep the selected ID stable. Never edit published versions in place.

Production reads the persona and its knowledge from Supabase `persona_packages`. The repository package is an export/review source; it does not silently substitute for a missing production database. Browser roles cannot read private configuration or publish packages. Server publication uses the existing `publish_persona_package` transaction and a verified administrator identity. No new public data grants are required.

## Response flow

1. Authenticate, enforce quota, verify conversation ownership and resolve its pinned persona version.
2. Apply the existing injection, harmful-request, privacy and role-change checks. Identity answers use published public metadata without model inference.
3. The Deshou flow retrieves up to eight records from **that persona's knowledge only**. Short follow-ups use bounded, server-owned history; visitor-supplied history cannot establish a museum conversation's context.
4. The configured DeepSeek model receives fixed platform instructions, the published museum identity, relevant records and bounded untrusted history. It writes a concise explanation and returns a strict JSON envelope with known record IDs. Knowledge is reference context; this does not train or fine-tune DeepSeek.
5. Validate the envelope, record IDs, identity, sensitive content, markup, unsupported numeric claims and a bounded set of common invented object descriptors. Specific physical details such as a tall ring foot cannot be inferred merely because another object of the same type has one. General cultural interpretation is explicitly distinguished from object-specific facts. Render only database citation links. Validated replies receive “AI explanation · museum references”; this label does not certify every claim as historically verified.
6. If generation or validation fails, use a clearly labeled matching published record, or ask for the exhibit's label. Never turn an unknown artifact into a guessed accession, owner, measurement or current display location.

General Southern Song context may explain a documented object, but must be distinguished from object-specific evidence. A suggestion for a viewing sequence is not a floor plan, accessibility route or current schedule. Unrelated travel itineraries are outside this museum role. Live weather and attachment analysis remain disabled for museum profiles; this change does not promise photographic authentication.

Questions explicitly requesting a known object's shape, measurements, material, inscriptions or provenance use a stricter path: the server renders the published description and a limitation statement. It does not ask the model to fill missing catalogue fields. Cultural and historical elaboration remains generative. The UI labels these documented descriptions separately from AI explanations.

If the model unnecessarily asks for clarification on an artifact already identified in server-owned history, one bounded correction asks it to explain the documented details and identify the missing ones. The same output validation still applies. A second clarification returns the known record with a limitation statement; a failed provider call is not retried or labeled successful generation.

## Verification and practical limits

`tests/deshou-museum.test.mjs` checks the package, reference retrieval, bilingual follow-ups, model-authored explanations, identity preservation, injection refusal, fabricated citations/numbers, service degradation and API persistence. The full existing regression suite covers authentication, tenant isolation, version binding, database permissions, deletion and other features.

Regex checks and numeric validation are defense layers, **not proof of semantic accuracy or a jailbreak-free system**. Curator review of the collection package and ongoing live-model evaluations remain appropriate before representing this as an official museum service. Publish updated versions when labels or exhibitions change. Never infer current opening hours or complete object inventories from this research package.
