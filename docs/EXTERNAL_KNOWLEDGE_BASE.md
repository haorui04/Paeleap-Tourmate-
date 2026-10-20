# External museum knowledge-base API (integration staging)

This folder contains a **server-side search client only**. As of this change,
it is **not wired into chatbot response generation**. The other team's response
JSON schema and a reachable deployment are still required before activation.

## Confirmed request contract

```http
POST /api/search
Content-Type: application/json
X-API-Key: <server-only credential>

{"query":"你的问题","top_k":5,"museum":""}
```

The provided development URL is `http://127.0.0.1:8765/api/search`.
That address refers to **the knowledge-base server's own machine**; it cannot
be reached from Vercel. Get a publicly reachable HTTPS POST URL or arrange
secure network connectivity. Do **not** expose the development server as-is.

## Configuration

For local development only:

```dotenv
KNOWLEDGE_BASE_ENABLED=true
KNOWLEDGE_BASE_URL=http://127.0.0.1:8765/api/search
KNOWLEDGE_BASE_API_KEY=<new-rotated-key>
```

For Vercel (when ready), use a reachable HTTPS URL. Add
`KNOWLEDGE_BASE_API_KEY` as an encrypted **server-only** value.
Never use `NEXT_PUBLIC_` for this key; do not add it to the Git repository.

Because a previous personal API key was sent as plain text, ask its owner to
**revoke/rotate the exposed key** before using the service in production.

## What is still needed

1. A reachable HTTPS endpoint and authorization for the backend to query it.
2. A sanitized example of a **successful** JSON response (including metadata
   such as article/source ID, relevance score and museum if present).
3. Whether access is search-only and how queries/user data may be retained,
   logged or processed by the provider.

Afterward, normalize and validate the provider's response fields; preserve
retrieved sources; run safety/output checks; add tests for empty/unsafe results,
authentication failures, timeouts and prompt injection; then enable behind
a feature flag in staging. Existing FAQ and Supabase flows remain unchanged.
