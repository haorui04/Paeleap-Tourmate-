# Museum analytics dashboard — first release

The admin dashboard contains artifact interest (top five + other), daily enquiry
trends, questions needing follow-up, and image-identification outcomes. Filters
select a published museum, China-time date range (1–31 days), and visitor or
administrator-test traffic. Chart data can be exported as formula-safe CSV.

## Collection and access

Set server-only ANALYTICS_ENABLED=true in Production/Preview after initializing
the private tourmate-analytics bucket and its configuration.json collection-start
timestamp using analyticsBucket(storage,true) and analyticsConfig(files,true).
Only production runtime collects; local demo and ordinary CI fixtures do not.
Use the existing Supabase service credential server-side. No new public database
tables, SQL functions, browser Storage grants or additional model calls are needed.
The dashboard endpoint verifies the existing administrator UUID allowlist before
reading any events or chat history. The bucket must remain private.

Each successfully saved museum exchange writes one immutable JSON event linked
to its persisted user-message UUID. Existing IDs cannot be overwritten. It records
museum/version, timestamp from the database, language, input type, outcome and
optional artifact identity. No prompt, answer, photograph, OCR, user token or user
identity is copied into the event. Administrator-account requests are marked test
using the server's verified allowlist; visitors cannot supply this classification.

Analytics must not make a successful chat fail: collection errors produce a fixed
server warning. The dashboard separately counts persisted user messages in the
same museum/time/traffic selection and compares that baseline with available
events. Missing metadata is visibly flagged as incomplete tracking. This check
does not establish factual correctness of a chatbot answer.

## Metric definitions

* Enquiries: saved user-message exchanges after collection starts. Each follow-up
  is another enquiry. Re-reading the same event never adds another count.
* Artifact interest: one uniquely named catalogue artifact in the visitor's query,
  a clear pronoun follow-up to the latest named user referent, or a validated
  single-artifact identification result. English/Chinese names share a stable ID.
  Merely retrieved/cited records do not establish interest. Multiple names and
  unresolved topics remain unclassified. Recognition uses the application's
  existing bounded museum artifact catalogue; this is not an exhaustive catalogue
  or a semantic topic classifier.
* Pie shares: classified artifact enquiries only; five largest identities plus
  other. Unclassified/non-artifact requests are reported outside that denominator.
* Daily trend: recorded enquiries grouped by Asia/Shanghai calendar date. Dates
  before collection and future dates show unavailable values, not invented zeros.
  First and current collection days may cover only part of a day.
* Follow-up queue: requests needing clarification, unmatched items, service
  unavailability, and in-scope requests without an answer. Safety/scope refusals
  are separate. Latest 100 are shown; the card retains the complete selected count.
* Image outcomes: matched catalogue record, no catalogue match, uncertain/more
  detail, unavailable service, rejected. These are operational outcomes, NOT
  identification accuracy or curator-confirmed correctness.

Question excerpts are fetched from existing surviving chat history, redacted,
then truncated to 240 characters. Deleting a chat cascades its messages; deleted
message IDs are excluded from the charts and cannot return question excerpts.
Metadata-only event objects remain in private storage; they are not raw chat
history. A separate metadata retention policy can be added as usage grows.

## Limits and reporting discipline

The first release uses immutable Supabase Storage events so it can use the
existing connection without granting arbitrary SQL access. It fully paginates
file listings, bounds downloads, and verifies event shape. More than 5,000 stored
events across the selected date folders produces an explicit range-too-large
error; it never silently truncates a chart. Download failures suppress the charts
instead of treating unread data as zero. For larger deployments, migrate to a
transactional analytics table and database-side aggregation.

Reports are refreshed snapshots, not transactionally simultaneous views of
ongoing writes/deletions. Retry refresh after active requests finish if coverage
differs. Changing administrator membership can reclassify the history-count
baseline while immutable old events retain their original traffic label; a
coverage warning then requires review. This is deliberately visible.

Pre-authentication, quota failures, unpersisted failures, local demos and activity
before initialization are outside these metrics. No historical inference is
performed. There are no example/seed visitors or fabricated production totals.

## Verification

tests/admin-analytics.test.mjs verifies date boundaries, unavailable historical
days, bilingual identity grouping, conservative classification, image outcomes,
deduplication, deleted-history exclusion, redaction, coverage warnings, test
traffic separation, private storage and administrator/cross-origin gates.
