# Publication and change summary — 24 October 2026

## Publication outcome

Write access was confirmed and a normal, non-force push succeeded directly to
`tejaaswinv/paeleap-chatbot`, branch `feat/museum-personas-security-2026-10-23`.
[Pull request #18](https://github.com/tejaaswinv/paeleap-chatbot/pull/18) targets
`main`. It has **not been merged or deployed**.

The existing implementation was reused, not rebuilt. Before publishing, the
new upstream commit `cbdc6bf2261ef2ae843e01f5f78939a0a4373771` was merged normally
into the feature branch without conflicts. This preserves the repository's
additional explicit-persona-hijack and poisoned-assistant-history protections.
The combined application source was retested at
`fb30c9b9f742735cff7868c1eb17ccb56d9a3019`.

The original 23 October test statistics and raw-evidence hash remain historical
records. Their original publication denial is preserved in
`github_publication_at_original_run`; the separate publication update records
the successful push and new verification. This does not relabel old test runs.

## What the changed files do

| Area | Files / directories | Result |
| --- | --- | --- |
| Persona and knowledge backend | `lib/personas/`, `app/api/personas/route.js`, `app/api/admin/personas/route.js` | Validated bilingual packages, administrator UUID authorization, append-only versions, isolated knowledge, public identity metadata and profile kill switch. |
| Administrator and visitor UI | `app/admin/page.jsx`, `components/PersonaAdmin.jsx`, `components/ChatShell.jsx`, `components/AuthPanel.jsx`, `app/globals.css` | Authenticated JSON upload/preview/publication workflow; persona-aware branding and greeting; neutral provenance labels. |
| Trips and client contracts | `components/useTripHistory.js`, `lib/client/chat.js`, `lib/client/personas.js`, `lib/client/trips.js`, `lib/types.js` | User/persona-scoped history and drafts; new trips preserve old conversations; server profile/version binding. |
| Safety and AI output | `app/api/chat/route.js`, `lib/ai/generate.js`, `lib/ai/safety.js`, `lib/ai/input-normalization.js`, `lib/ai/provider.js`, `lib/tourism/evidence-fallback.js` | Visitor persona changes and known malicious requests refused; constrained approved-record selection rather than unchecked generated prose; bounded provider resources and reviewed fallback. |
| FAQ relevance and database integration | `data/china-tourism-faq.js`, `lib/tourism/faq-matching.js`, `lib/db/supabase.js`, `supabase/` | Original 100 bilingual answers retained, reviewed aliases added, RLS/immutable persona bindings/atomic paired messages and NULL-quota hardening. |
| Example integration | `examples/personas/`, `docs/MUSEUM-DEPLOYMENT.md`, `.env.example` | Reusable persona JSON contract, an explicitly labelled Little De Rabbit demo and administrator/deployment instructions. No real museum knowledge is invented. |
| Verification and maintenance | `tests/`, `scripts/`, `.github/workflows/backend-check.yml`, `package.json`, `package-lock.json`, `.gitignore`, `AGENTS.md` | Retained attack regressions, real local SQL-engine checks, syntax/audit/build checks and downloadable CI test evidence. |
| Documentation and evidence | `README.md`, `DEPLOYMENT.md`, `SECURITY-TESTING.md`, `docs/SECURITY-REMEDIATION-2026-10-23.md`, this file, `reports/security-remediation-summary.json` | Setup, safety trade-offs, explicit launch gates and separately dated test/publication records. |

The PR's **Files changed** tab is the authoritative complete file-by-file diff.
The implementation is a safety-oriented knowledge companion, not unrestricted
generative RAG: the model selects approved records and the server renders their
reviewed text with configured persona framing. Knowledge links are references,
not an automatic web crawler. Current integration is by venue links, same-origin
hosting or authenticated API use, not a universal drop-in cross-origin widget.

## Verification after integrating current main

[GitHub Actions run 40107988071](https://github.com/tejaaswinv/paeleap-chatbot/actions/runs/40107988071)
completed successfully on 24 October, using clean Ubuntu and Node 22:

| Check | Recorded result |
| --- | --- |
| Node suite | 1,549 passed, 0 failed/cancelled/skipped; includes local PGlite SQL checks. |
| JavaScript/MJS syntax | 61 passed; JSX additionally compiled by the production build. |
| FAQ bank inspection | 100 bilingual records. |
| Controlled remediation replay | 500 retained rows × 5 modes = 2,500 route executions; 0 strict failures, unsafe escapes or fixture failures. |
| Output probes | 12/12 passed under the evidence-only output contract. |
| Earlier red-team runners | Offline and provider-adversarial fixture runs completed successfully. |
| Dependency audit | 0 known vulnerabilities reported at execution time. |
| Default production build | Passed in GitHub Actions. |
| Local independent rerun | Same 1,549 tests and 2,500 route executions passed on Windows/Node 26.2.0. |
| Local alternative build | `npm run build -- --webpack` passed. |

The local default Turbopack build failed while starting its CSS compiler worker,
both inside and outside the sandbox. The exact same source built successfully
with the supported Webpack option locally and with default Turbopack in clean
Linux CI. The root cause of the local Windows/Node 26 failure is **not proven**;
it has not been hidden or labelled a source-code fix. No build-script default
was changed. CI runs Node 22; use the documented Webpack option when reproducing
this local build issue.

The local raw remediation report has SHA-256
`3ff4d27c4198393b0fd3d32e45165d01cb9a86411402debbb0313de2cd8fc736`.
CI attaches `offline-redteam-evidence` to the run, with 30-day retention.
Publication bookkeeping after this source revision changes documentation and
summary metadata, not application behavior.

## Release boundary

These are regression and integration checks, not proof that every jailbreak is
prevented. The corpus contains 479 distinct scenarios across 500 retained rows,
and all are known regressions, not an unseen holdout. Provider-adversarial modes
use controlled fixtures. **Actual model calls: zero. Hosted Supabase tested: no.**

Before public launch, apply and validate the SQL migrations in staging, configure
real server-side credentials/admin UUIDs, import actual curator-approved museum
content, and test the chosen model, real two-account isolation and concurrent
operations. Also complete mobile/accessibility, privacy/retention, abuse/spending
and incident-response checks. Source permissions and applicable legal compliance
need appropriate review; passing this suite is not certification.
