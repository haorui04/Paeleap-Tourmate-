# Paeleap TourMate — choose the actual AI protocol

**Important (2026-10-22):** The OpenCode JSON posted in chat configures
`@ai-sdk/anthropic` with **Claude Opus/Sonnet**, not a Kimi model. Do not
interpret that JSON's `$schema` as the inference wire API. Never paste a real
API key into chat or GitHub; the previously exposed key must be revoked.

## Required configuration (new Vercel team / project)

Set the following **server-only** environment values in the actual Vercel
project now hosting Paeleap. Do not set `NEXT_PUBLIC_` on keys.

```dotenv
AI_BASE_URL=https://api.miaoquai.com/v1
AI_MODEL=<exact model ID that this API key can access>
AI_RESPONSE_MODE=grounded
AI_MOCK_MODE=false
AI_API_STYLE=<one of responses, chat_completions, anthropic>
SUB2API_API_KEY=<new key generated for the correct model group>
```

The chatbot reads SUB2API_API_KEY (preferred) or AI_API_KEY (fallback).
Model access is group-specific. **An Anthropic Claude model ID is not a Kimi ID**.

| Desired provider | AI_API_STYLE | POST inference path | Request authentication |
|---|---|---|---|
| OpenAI Responses (previous DeepSeek / Codex) | `responses` | `/v1/responses` | Authorization: Bearer |
| Kimi on an OpenAI Chat Completions-compatible group | `chat_completions` | `/v1/chat/completions` | Authorization: Bearer |
| Claude on an Anthropic-compatible group (pasted OpenCode config) | `anthropic` | `/v1/messages` | x-api-key + anthropic-version |

The paths above are *client protocol conventions*, not proof that the
third-party gateway routes each model there. Confirm your exact Kimi model
ID and permitted protocol in that group's model catalog/docs.

## Local connectivity probe (no raw outputs or secrets)

Set `AI_MODEL`, `AI_API_STYLE`, `AI_BASE_URL`, and a rotated key in
your local environment, then run `npm run ai:check`. A successful probe
checks actual response content was parsed; it does not validate chatbot
safety, FAQ grounding, deployed authentication or Supabase.

## New-team access

The connected Vercel account currently exposes only the previous personal
team. The transferred/new-team Paeleap project is not accessible through that
connection. Connect or reauthorize the Vercel plugin for the new team, or
update the environment in its dashboard manually. **Do not recreate a second
project or deploy to the old one as a workaround.**

## Security and testing

Never auto-try multiple API endpoints with the same key. This change only
adds protocol selection, mocked integration tests and accurate diagnostics.
There has not yet been a verified provider-backed live response, and
`AI_RESPONSE_MODE=grounded` remains gated by deployment configuration.
