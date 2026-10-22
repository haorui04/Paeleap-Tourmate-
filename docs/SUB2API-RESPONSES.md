# Sub2API / Miaoqu DeepSeek Responses integration (2026-10-22)

The Codex TOML config is for the Codex client, not a schema accepted by
`/api/chat`. A Next.js backend sends HTTP JSON to the Responses endpoint.

## Test minimal inference independently

Set a **new rotated key** in your terminal (do not paste keys in chats,
screenshots, GitHub issues, or commits), then run:

```sh
curl --fail-with-body -sS 'https://api.miaoquai.com/v1/responses' \
  -H "Authorization: Bearer ${SUB2API_API_KEY}" \
  -H 'Content-Type: application/json' \
  -d '{"model":"deepseek-v4-pro","input":"Reply with the word OK.","stream":false}'
```

The endpoint must return a JSON `response` object with assistant output.
The `/v1/models` endpoint lists available models but does not generate a
response. The `~/.codex/config.toml` TOML cannot be pasted as HTTP JSON.

## Vercel server-side configuration

- `AI_BASE_URL=https://api.miaoquai.com/v1` (the application appends `/responses`)
- `AI_MODEL=deepseek-v4-pro`
- `AI_API_KEY=<new-rotated Sub2API API key>` (server secret, never NEXT_PUBLIC_)
- `AI_MOCK_MODE=false`
- `AI_RESPONSE_MODE=faq` is the default, conservative fixed-answer mode.
- `AI_RESPONSE_MODE=grounded` enables conversational DeepSeek output grounded
  in the curated FAQ bank; **enable after successful staged provider smoke test**.

The backend sends the minimum portable Responses payload
`{model,input,stream:false}`; upstream DeepSeek Responses is documented to
be stateless. Confirm third-party gateway data handling separately.

## What is and is not fixed

The gateway-compatible minimum wire payload, response extraction, safe
error diagnostics and a natural-language generation path are implemented.
Tests mock the provider, not real Miaoqu. If Miaoqu responds 401/403, rotate
and configure the key / entitlement. If it responds 400/404, verify model
access and group routing. If it responds 429, check remaining quota.
No code change can authorize an invalid account or missing group access.

Knowledge-base retrieval from the other team is **not yet connected**:
their last URL was `127.0.0.1`, inaccessible from Vercel, and no response
schema was provided. Current grounded mode uses only curated local/Supabase
FAQs. It must not be represented as full museum-KB RAG.

## Risk and privacy

Do not paste any real API key into diagnostic requests stored in source
control. A personal key previously shared in a screenshot should be revoked.
Generated responses are checked by existing deterministic output checks; this
does not prove comprehensive model safety, and independent red-team testing
is still required.

## 503 service-unavailable incident (22 October 2026)
An actual production Vercel log showed `HTTP 503`, `errorCode: unclassified`
for the Miaoqu Responses endpoint. This is a provider/gateway rejection,
**not evidence of a wrong JSON schema**. DeepSeek's official documentation
describes HTTP 503 as server overload; Sub2API gateways can also return 503
when the key's group has no available model channel.

The Responses client performs **one** extra attempt after 750 ms on 503 only.
If a second 503 occurs, TourMate still falls back safely. A retry cannot fix a
nonexistent model route or an unavailable provider group.

Check the provider dashboard for the API key's **group**, model entitlement,
remaining credits and available channels. If it persists, supply the provider
with the request timestamp, `deepseek-v4-pro`, `POST /v1/responses`, HTTP 503,
and the *provider's request ID*, if shown in private diagnostics. Never share
the bearer token or private prompt.
