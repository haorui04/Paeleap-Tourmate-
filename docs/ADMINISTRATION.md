# Tourmate museum administration

Open /admin and sign in with an account whose verified Supabase user UUID is in
the server-only PERSONA_ADMIN_USER_IDS allowlist. Normal sign-up does not confer
administration rights. Never store this permission in user-editable metadata.

## Workflow

1. Select a published museum or create a unique museum ID.
2. Edit bilingual name, venue, role, greeting, tone and allowed topics.
3. Search knowledge by ID, English/Chinese question or answer. Add/edit records
   and up to six HTTPS source references per record. Removal affects the draft;
   old published versions remain immutable.
4. Save a browser draft and optionally export a JSON backup. Resume the last
   draft after reloading, including a new, not-yet-published museum.
5. Review the greeting, scope and all knowledge records in Review & publish.
   Changes clear the review checkbox. Publish only after checking both languages.
6. The server validates all fields and permissions again. Duplicate questions,
   IDs, credentials, unsafe instructions and invalid source URLs are rejected.
   Competing/stale publications return a conflict rather than overwrite content.
7. New conversations use the newly published version. Existing conversations
   retain their version binding. Start a new conversation to verify changes.

Version history lists up to 100 recent publications. Restore as new draft copies
the selected historical package, assigns the next version, and requires review
and publication. It never deletes or modifies history.

## Storage and boundaries

Drafts use this browser's localStorage, keyed by account UUID and museum ID.
They are NOT shared cloud drafts or encrypted storage. On a shared device,
people with access to the browser profile may inspect local data. Do not enter
secrets or visitor information. Browser clearing/quota errors may prevent draft
retention; JSON export provides a portable backup. Successful publication clears
that museum's browser draft.

Published packages, version metadata and publisher identity remain in Supabase.
The new /api/admin/personas/history GET endpoint verifies administrator identity
before reading private content. It does not grant browser database permissions,
expose server credentials or return visitor transcripts. The existing atomic
publish RPC continues to enforce monotonic versions.

The built-in travel profile cannot be overwritten. Persona edits cannot override
platform guardrails. Knowledge links are references, not automatic web crawling.
Image identification remains subject to the supported museum profile and
configured vision provider; creating a profile does not automatically add a
reviewed image catalogue for that museum.

The original JSON import/preview/publish interface remains available below the
visual editor. Uploaded packages follow the same validation and permissions.

## Verification

tests/admin-editor.test.mjs covers history authorization, cross-origin refusal,
version input bounds, private package reads, draft schema checks, account
separation, bilingual search and immutable restoration. tests/personas.test.mjs
retains publication conflict, URL/supply-chain validation and platform-boundary
coverage. Browser draft saves are convenience storage, never authorization.
