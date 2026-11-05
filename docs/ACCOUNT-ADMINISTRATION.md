# Accounts, usage and guardrail review

Open /admin → Accounts & safety. The dashboard also shows account-count cards.
Counts paginate the Supabase Auth directory, verify supplied pagination totals,
and distinguish regular registered users, existing allowlisted administrators,
and anonymous accounts. Counts are refreshed snapshots; lists beyond 10,000
accounts fail explicitly. User-editable metadata never determines permission.

Select an account to view saved user-message counts: all time, 24 hours, seven
days, 30 days, and surviving conversations. These are exact database counts,
not billed tokens, model cost or quota counters. Deleted messages and unpersisted
requests are excluded. Usage covers all this application's stored personas.

The review scans up to the latest 5,000 saved user questions in the past 30 days
using the current deterministic input guardrails. It flags accounts with three
blocked-detector matches in 24 hours or five in 30 days. Duplicate message IDs
are deduplicated. Emergencies and ordinary out-of-scope questions do not qualify.
Redacted excerpts support staff review. This retrospective heuristic is not an
immutable record of historical enforcement or proof of intent. False positives
require human review; no automatic suspension or permission change occurs.
Incomplete scans explicitly show reviewed/total coverage. Deleted history cannot
be reviewed. Attempts rejected before persistence are outside this first release.

Password recovery sends a request to Supabase's recovery endpoint using ONLY the
email retrieved server-side for the selected account. Administrators cannot read
or set another user's password, see recovery tokens, or choose arbitrary email
recipients. An immutable private Storage audit slot limits requests per target
to one per five-minute slot across server instances. Provider rate limits also
apply. Failed requests retain the audit slot and record a failure event.

The user opens the email and chooses their own password on /reset-password.
The normal email template must use Supabase's ConfirmationURL. Configure the
project's Site URL as https://paeleap-chatbot-test.vercel.app and allow the exact
redirect https://paeleap-chatbot-test.vercel.app/reset-password in Authentication
→ URL Configuration. A root PASSWORD_RECOVERY listener also handles providers
falling back to the site's root URL. Custom templates or PKCE flows require
separate integration. Supabase SMTP, delivery limits, spam filtering, and an
expired/reused link can prevent recovery; accepted means requested, not delivered.

All account APIs require the existing server-verified administrator allowlist,
reject cross-origin mutations and unsupported fields, and use no-store responses.
Auth records are projected onto documented safe fields; credentials, sessions,
identities and raw user metadata are never returned. Server-side keys stay on
the backend. Audit objects remain in the private tourmate-analytics bucket.
