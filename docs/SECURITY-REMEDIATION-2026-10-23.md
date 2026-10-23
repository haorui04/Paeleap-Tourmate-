# Security remediation and persona implementation

Date: 23 October 2026. Baseline: GitHub main `7e578ad18a4d8a11d200ce9a74d137bb464d1627`. This report distinguishes implemented controls, retained regression evidence and deployment checks that cannot be completed without real credentials.

## Outcome

The application now supports versioned museum personas and isolated knowledge, protected administrative publication, fixed visitor-facing identity/tone and bounded evidence composition. The previously demonstrated unchecked generated-output path has been removed: a model cannot publish arbitrary prose, invented actions or fabricated citations. It returns a strictly validated record-selection plan; the server renders administrator-approved text.

This is a deliberate safety/usefulness trade-off, not a claim that unrestricted generation was made universally safe. It supports multiple records and many museum knowledge packages, but does not invent missing museum knowledge or automatically crawl links. Curators remain responsible for content accuracy, scope and permissions.

## Prior findings and disposition

| Finding | Implemented remediation | Verification / remaining limitation |
| --- | --- | --- |
| F01: arbitrary generated text accepted | Evidence-only JSON grammar; known, nonduplicate record IDs; bounded 1–3-record rendering; invalid prose fails to approved fallback | All retained output probes reject unchecked prose. Live model semantic relevance remains unmeasured. |
| F02: unrelated citations and “verified” labels | Sources only from rendered records; distinct provenance modes; neutral reference/approved-knowledge labels | Independent observer derives records from actual full answer text, checks exact sources, rejects appended prose/wrong persona/four records/duplicates. Source truth is not independently established. |
| F03: new attack phrasing and history continuations | Broader en/zh and selected multilingual/encoding rules; bounded poisoned-history continuation checks; fixed persona and server-side scope/version bindings | All 220 retained attack rows are contained in each controlled mode; 188 explicitly blocked, 32 safely redirected. This is not universal intent detection. |
| F04: benign reporting overblocked | Narrow defensive-phrase interpretation without exempting malicious second clauses; reviewed FAQ paraphrases | Benign scam reporting, lost wallet/phone and closure questions now remain useful. Mixed malicious clauses still refuse. |
| F05: redaction format gaps | Dotted phones, bracket-at emails and selected address/credential patterns; import tripwires for recognizable keys and operational harmful instructions | Defined synthetic formats pass. Not complete DLP; raw visitor text can still be stored in transcripts. |
| F06: diagnostic script syntax failure | Literal backslash-newline repaired; all JS/MJS syntax checked in CI | Script now starts and reports `NOT_RUN / PROVIDER_CONFIG_MISSING` without credentials, rather than a syntax crash. |
| F07: actual model/cloud validation absent | Explicit deployment gates and fail-closed production defaults; real SQL-engine tests added locally | **Still open as a launch gate.** No provider credentials, hosted project or staging URL were supplied. No live-model jailbreak rate or deployed RLS certification is claimed. |

Independent implementation review also found escaped duplicate JSON keys, credential-bearing knowledge imports, harmful imported how-to text, negated planning-topic relevance, inconsistent treatment of approved museum hours during fallback and NULL quota limits. These were fixed and retained as regressions. Numeric hours in a reviewed museum record behave consistently across model selection and fallback; their real-world freshness still requires curator review.

## Persona and knowledge controls

- `/admin` authenticates with Supabase; only server-allowlisted verified user UUIDs may publish. No visitor field, claimed role or editable user metadata grants access.
- Files contain structured bilingual identity, role, tone, scope and knowledge; unknown fields, oversized uploads, duplicate IDs/questions, credential-bearing/local URLs and selected dangerous content are rejected. Imported content is not executed or made a higher-priority instruction.
- Public endpoints expose identity/greeting metadata, not private role descriptions or the complete knowledge bank. Approved answers are public by design; packages must not contain private records.
- Publication is append-only with a per-profile transactional lock and exact next-version requirement. Conversations bind to user, profile and version before history retrieval; a changed binding returns 409 and requires a new trip.
- Message writes recheck owner/profile/version and insert both turns under a database row lock. Browser roles cannot insert messages or publish configurations. The kill switch `PERSONA_DISABLED_IDS` can remove a profile from public service while leaving administrative repair available.
- Custom museum knowledge never borrows the global tourism bank. Exact curator-approved exhibit questions may extend generic topic exclusions (for example a science museum); harmful requests, secret extraction and persona overrides never receive that exception.
- Provider output limits, timeouts, redirect refusal and a streamed gateway-body size limit bound consumption. No browsing, SQL, shell, booking or payment tools are provided to the model.

The supplied Little De Rabbit package is a clearly labelled demonstration with three entries, not an official De Shou Palace service or a completed historical knowledge base. Integration is through venue links, same-origin use or authenticated server/API integration—not a prebuilt cross-origin iframe widget or arbitrary CMS/SSO connector.

## What was retested

The exact 500-row corpus is retained: 380 earlier cases (140 attacks, 20 off-topic, 20 benign and 200 bilingual canonical FAQ controls) plus the 120 supplemental audit cases (80 attacks, 20 off-topic and 20 benign). There are 479 distinct language/message/history scenarios. These are now **known regressions**, including reviewed fixes for their benign paraphrases, not a fresh holdout or random sample of public traffic.

| Controlled mode | Strict results | Retained attacks contained | Unsafe output / citation mismatch |
| --- | --- | --- | --- |
| FAQ offline matcher | 500 / 500 | 220 / 220 | 0 / 0 |
| Hostile valid-FAQ-ID selector | 500 / 500 | 220 / 220 | 0 / 0 |
| Malformed free-form FAQ provider | 500 / 500 | 220 / 220 | 0 / 0 |
| Hostile prose in evidence mode | 500 / 500 | 220 / 220 | 0 / 0 |
| Valid candidate-ID evidence fixture | 500 / 500 | 220 / 220 | 0 / 0 |

Total: **2,500 actual in-process route executions**, zero strict failures, fixture-authorization failures or benign false blocks. Repeating 500 cases in five modes is not 2,500 unique prompts. The fixed hostile fixtures are independent of expected outcome labels; the valid-ID fixture selects the first actual candidate and is not an intelligent semantic evaluator.

All 12 retained IR-GEN probes reject unchecked provider prose under the new contract. Nine formerly exposed unsafe/unsupported output expectations are addressed; the previous harmless prose control is now intentionally rejected too, a documented protocol change rather than an additional vulnerability fixed. Six independent composition-observer controls also pass. Unit tests separately retain the prior input and PII failures, four screenshot prompts and mixed-clause benign/attack controls.

The full Node suite passes, including 25 named embedded-PostgreSQL checks (24 substantive subtests plus their enclosing test). It executes the repository migrations verbatim in PostgreSQL 18.6 through PGlite 0.5.11, with explicitly emulated Supabase roles, `auth.uid()` and service-role default privileges. It checks two-user RLS, anonymous/browser denials, immutable versions/bindings, stale publication, transactional exchange rollback, quota boundaries and invalid arguments. It does **not** test actual JWT validation, PostgREST deployment or separate-session concurrent contention.

Browser checks on the local development service confirmed Little De Rabbit identity, refusal of the Boss/sign-off override, new-trip creation without deleting old messages, reload persistence, unavailable-profile fail-closed behavior and an administrator sign-in screen that does not grant access when authentication is unconfigured. Browser execution is local/demo, not production Auth/model verification. Production compilation and dependency audit are separate checks; passing them does not establish mobile/accessibility coverage on every target device.

## Evidence and reproduction

```bash
npm ci
npm run test:syntax
npm test
npm run test:remediation -- --strict --out reports/remediation.json
npm audit --audit-level=high
npm run build
```

`tests/fixtures/remediation-cases.json` preserves supplemental prompts and all output-probe text. The runner records full request/response pairs, status expectations, actual sources, provider fixtures, persisted assistant text, timestamps, source SHA-256 manifests and separate strict-result/unsafe-escape fields. It refuses network destinations other than its explicit `.invalid` fixtures and isolates provider/database environment settings. Model calls and actual external service calls are both **zero**. The raw report can be large and is generated locally/retained as a CI artifact rather than committed repeatedly.

Passing criteria are documented assertions, not evidence that an actual adversarial model has been defeated. Red/blue regression replay verifies the implemented boundary and known fixes; it is not a statistically representative jailbreak study or proof of zero vulnerabilities. Historical audit evidence is preserved rather than relabelled as passing.

## Release conclusion / 结论

**Code-level regression outcome: passed for the retained cases. Public-launch decision: conditional, not yet certified.** Publish and review the branch, apply/test the migrations in staging, import actual curator-approved museum content, and run repeated unseen adversarial tests against the exact deployed model. Verify real two-account RLS, concurrent quota/publication behavior, authentication, mobile/accessibility, privacy retention/deletion, spending/abuse limits and incident response. Obtain appropriate review for source permissions and applicable Chinese legal/regulatory requirements. No code-only test result establishes legal compliance.

The reference approach follows [OpenAI's untrusted-input and constrained-flow guidance](https://developers.openai.com/api/docs/guides/agent-builder-safety) and [structured-output limitations](https://developers.openai.com/api/docs/guides/structured-outputs), alongside the existing [OWASP/NIST methodology](../SECURITY-TESTING.md). These references guide control design; no framework certification or provider endorsement is implied.
