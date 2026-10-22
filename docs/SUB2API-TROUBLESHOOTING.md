# Sub2API DeepSeek integration diagnosis (October 2026)

## Interpreting the error
If TourMate says “AI generation is temporarily unavailable”, the `grounded`
branch attempted inference and then fell back to a local FAQ matcher.
That text **does not prove** the API key is wrong: provider HTTP failures,
timeouts, and malformed responses can all cause it.

## Check deployment first
The previously connected Vercel team returned **no project named
`paeleap-chatbot`** on October 22, 2026, so access to that
deployment or its logs is **not verified**. If the project moved to a new
team, reconnect the correct project before attempting changes.

## Live provider smoke test
Generate a **new** Sub2API key: an older credential was exposed in a chat
screenshot and should be rotated.

On your Mac, set the key in your terminal session without committing it:
```sh
read -s SUB2API_API_KEY
export SUB2API_API_KEY
npm run ai:check
```
The script sends one very small request to `/v1/responses` and prints
only safe metadata (SUCCESS or a diagnostic code); it never prints keys,
prompts or the returned model text. A provider call may consume usage/quota.

Expected environment variables for Vercel's **server**, not browser:
```text
AI_BASE_URL=https://api.miaoquai.com/v1
AI_MODEL=deepseek-v4-pro
AI_RESPONSE_MODE=grounded
SUB2API_API_KEY=<rotated key>
```
The code also supports legacy `AI_API_KEY`. If both are present, the
dedicated `SUB2API_API_KEY` takes precedence. Never prefix secrets with
`NEXT_PUBLIC_`. Redeploy after changing Vercel environment settings.

## If still failing
In your browser DevTools, inspect the **Response** tab of an authenticated
`POST /api/chat`. A fallback response includes:
```json
{"ai":{"mode":"curated_faq_fallback","errorCode":"UPSTREAM_HTTP_401"}}
```
This is only an *example*; the actual error code comes from the failed
call. The response never includes an API key or raw upstream body.

- `UPSTREAM_HTTP_400`, `422`: provider rejected request fields or payload.
- `UPSTREAM_HTTP_401`: key invalid, missing, or expired.
- `UPSTREAM_HTTP_403`: key group or model access forbidden.
- `UPSTREAM_HTTP_404`: endpoint/model route missing or not supported.
- `UPSTREAM_HTTP_429`: quota or rate limit.
- `UPSTREAM_HTTP_5xx`: gateway/upstream server error.
- `PROVIDER_CONFIG_MISSING`: no valid server-side key or settings.
- `INVALID_PROVIDER_RESPONSE`: non-JSON, missing text, refusal, or unexpected schema.
- `UPSTREAM_NETWORK_ERROR`: network failure or unexpected adapter exception.
- `UPSTREAM_TIMEOUT`: request timed out.

These categories help diagnose the real API issue without inventing
a cause. The existing FAQ fallback, authentication and input/output
safety checks remain in place. The museum team's external knowledge base
is not yet connected; grounded mode uses curated FAQ context only.
