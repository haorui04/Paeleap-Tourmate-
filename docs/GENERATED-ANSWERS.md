# TourMate: AI-written answers from the knowledge bank

`AI_RESPONSE_MODE=generated` enables a reference-grounded answer path for the
default TourMate persona. Existing `faq` and `grounded` modes remain available.
Custom museum profiles continue to render approved records so their previously
tested output boundary is preserved.

## Request flow

1. Validate the request, authenticate the visitor, enforce quotas and bind the
   conversation to its administrator-defined persona.
2. Apply the existing input, privacy, emergency, role and scope checks.
3. Retrieve up to eight FAQ references. A reviewed English/Chinese transport
   paraphrase retrieves train, metro, taxi, ride-hailing and domestic-flight
   guidance for broad questions such as “How do I travel around in China?”
4. Send only those reference answers, the current redacted question and bounded
   untrusted history to the configured provider. No user/secret tables or server
   credentials are included in the prompt. Provider authentication stays private.
5. Ask the model to write a concise answer using the references and cite known
   record IDs in a strict JSON envelope. The output cap is 1536 tokens.
6. Validate the envelope, record IDs, length, links, obvious unsafe/role-changing
   content, credential-like strings and unsupported numeric claims. Attach only
   the selected records' approved HTTPS sources. The UI says
   “AI-generated · knowledge references” for accepted generated text.
7. If the provider fails or validation rejects its output, make no second model
   request. Use exact-match or reviewed broad-transport guidance when available,
   clearly labeled as fallback. Otherwise report temporary unavailability.
8. Save the exchange through the same authenticated, owner-checked storage path.

Insufficient evidence produces a clarification rather than implying that every
unmatched tourism question is unrelated to China. This mode does not add web
search, live prices, bookings, map navigation or unsupported museum knowledge.

## Configuration

Set `AI_RESPONSE_MODE=generated` in the intended Vercel project/environments and
redeploy. Retain `FAQ_BANK_SOURCE=supabase`, `ALLOW_LOCAL_DEMO=false` and
`AI_MOCK_MODE=false`, plus the existing server-only provider/database settings.
Do not change keys, provider, budgets or safety rules to disguise an outage.

`/api/status` confirms the selected mode and variable presence. It does not call
the model. To verify inference, submit a signed-in question and inspect the
`POST /api/chat` response: `ai.mode` must be `generated_answer`, not
`curated_faq_fallback`, `curated_faq` or `knowledge_clarification`.

Try broad transport in English and Chinese, payment questions, a request to
change persona and an unrelated programming request. Confirm useful supported
answers for the first group and refusals for the latter group. Use a fresh trip
when comparing behavior; existing stored replies are not regenerated.

## Evidence limits

These checks reduce risk; they do not prove that arbitrary model paraphrases are
factually entailed by their references or that every jailbreak is blocked.
`generated` deliberately has a different, less deterministic output boundary
than approved-record rendering. Conduct live adversarial and factual review
before a public launch. Unit/API fixtures use synthetic services and must not be
reported as successful live-model or real-account end-to-end tests.

The old FAQ labels in saved conversations remain accurate for those old
responses. AI provenance is returned with the live response; the current
messages table stores text, not historical generation metadata. Separate audited
telemetry would be needed for durable per-message generation statistics.
