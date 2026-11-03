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

The original JSON import/preview/publish interface is in the collapsed Advanced
tools section. The main workspace follows Choose museum → Edit → Review/publish.

## Connected Supabase knowledge sources

1. Choose a museum in the main workspace, then open **Knowledge sources**.
2. Leave the URL empty and choose **Connect current Supabase**. Alternatively,
   paste this application's Supabase project origin or an authenticated/public
   object URL for a file in its `tourmate-knowledge` bucket. Different projects,
   signed links, arbitrary database endpoints and credentials are rejected.
3. Connect initializes the dedicated private bucket when absent. An existing
   public bucket is refused; its permissions are never silently changed. No
   new browser Storage policies are granted. Access is through the authenticated,
   administrator-authorized server endpoint and the existing server credential.
4. Preview a published museum's database knowledge, or a supported file in this
   bucket. The list shows supported files among the first 100 root entries;
   enter a full path for nested files. Paths use ASCII letters, digits, hyphens,
   underscores, dots and slashes. The project URL is resolved from server config;
   it is not a database password and does not confer access by itself.
5. Upload new JSON, TXT or Markdown files from the editor (maximum 1 MB).
   Server-side downloads are bounded to 2 MB; plain text is limited to 12,000
   characters. PDF, Word files and arbitrary SQL tables are not supported by
   this importer. Uploads are validated and stored as canonical JSON, never
   overwrite existing objects, and do not publish anything.
6. JSON accepts an array of knowledge records, `{ "knowledge": [...] }`, or a
   persona package containing knowledge. Only knowledge is imported: identity,
   role and platform policies are not copied from the linked file. Records use
   the same schema as a published package: `id`, `question_en`, `question_zh`,
   `answer_en`, `answer_zh`, and `sources` (`name` and public HTTPS `url`).
7. TXT/Markdown are split into bounded source excerpts. Both answer fields retain
   the original text; this is NOT bilingual translation. Edit titles and both
   languages in the Knowledge editor before publishing. The source filename
   determines stable IDs, so reimporting the same path updates matching excerpts.
8. **Add to draft** merges by record ID, updating matching IDs. Unmatched existing
   records remain. The explicit Replace ALL checkbox instead replaces the draft's
   whole collection. Check removal of stale excerpts if a revised text file is
   shorter. Publication revalidates duplicates, sources, content and the complete
   2 MB / 2,000-record package limit.
9. Review all imported records, save/export a draft as needed, then publish.
   New conversations retrieve from this versioned Supabase package. This is a
   reviewed snapshot, not a live SQL connection or continuous file crawler.
   Source changes require refreshing, reimporting and publishing again. Connection
   selection itself is page state, not a saved cloud connector configuration.

This endpoint can read only published museum packages and the fixed knowledge
bucket. It cannot browse visitor chats, Auth users, unrelated tables or buckets.
Storage requests are restricted to the configured project, refuse redirects,
time out and cap response bytes. Content checks are defense in depth and do not
replace curator review for accuracy, permissions or sophisticated injection.

## Verification

tests/admin-editor.test.mjs covers history authorization, cross-origin refusal,
version input bounds, private package reads, draft schema checks, account
separation, bilingual search and immutable restoration. tests/personas.test.mjs
retains publication conflict, URL/supply-chain validation and platform-boundary
coverage. Browser draft saves are convenience storage, never authorization.

tests/admin-knowledge.test.mjs checks source isolation, traversal/unsupported
formats, unsafe content, response limits, private bucket initialization,
administrator/cross-origin gates, preview-only behavior, identity separation,
non-overwriting uploads and bounded draft merging.
