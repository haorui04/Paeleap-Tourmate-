// Server-only adapter for the museum team's POST /api/search service.
// Do not import this module into client components or expose its raw result.
import { hasConfiguredValue } from "../config.js";

export function knowledgeBaseEndpoint(value, nodeEnv = process.env.NODE_ENV) {
  if (!hasConfiguredValue(value)) throw new Error("Knowledge base endpoint not configured");
  let url;
  try { url = new URL(value); }
  catch { throw new Error("Invalid knowledge base endpoint"); }

  const hostname = url.hostname.toLowerCase();
  const loopback = hostname === "localhost" || hostname.endsWith(".localhost") ||
    hostname === "127.0.0.1" || hostname.startsWith("127.") || hostname === "[::1]";
  const localDev = nodeEnv !== "production" && loopback && url.protocol === "http:";

  if (!(url.protocol === "https:" || localDev) || (nodeEnv === "production" && loopback))
    throw new Error("Knowledge base endpoint must be a reachable HTTPS URL in production");
  if (url.username || url.password || url.hash || url.search || !url.pathname.endsWith("/api/search"))
    throw new Error("Knowledge base endpoint must be an unmodified /api/search URL");
  return url.toString();
}

export function knowledgeBaseConfigured(env = process.env) {
  return env.KNOWLEDGE_BASE_ENABLED === "true" &&
    hasConfiguredValue(env.KNOWLEDGE_BASE_URL) &&
    hasConfiguredValue(env.KNOWLEDGE_BASE_API_KEY);
}

export async function searchKnowledgeBase({
  query, topK = 5, museum = "", env = process.env, fetchImpl = fetch
}) {
  if (!knowledgeBaseConfigured(env)) throw new Error("Knowledge base not configured");
  if (typeof query !== "string" || !query.trim() || query.length > 1500)
    throw new Error("Invalid knowledge base search question");
  if (!Number.isInteger(topK) || topK < 1 || topK > 10)
    throw new Error("Invalid knowledge base top_k");
  if (typeof museum !== "string" || museum.length > 120)
    throw new Error("Invalid knowledge base museum filter");

  const destination = knowledgeBaseEndpoint(env.KNOWLEDGE_BASE_URL, env.NODE_ENV);
  const response = await fetchImpl(destination, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": env.KNOWLEDGE_BASE_API_KEY
    },
    body: JSON.stringify({ query: query.trim(), top_k: topK, museum }),
    signal: AbortSignal.timeout(10000),
    cache: "no-store"
  });
  // Never echo the upstream body or secret-bearing request into the error.
  if (!response.ok) throw new Error("Knowledge base returned HTTP " + response.status);
  const length = Number(response.headers.get("content-length") || 0);
  if (length > 200000) throw new Error("Knowledge base response too large");
  const body = await response.text();
  if (body.length > 200000) throw new Error("Knowledge base response too large");
  try {
    const data = JSON.parse(body);
    if (data === null || typeof data !== "object") throw new Error("Invalid JSON shape");
    // Return raw parsed JSON only to trusted server logic. We cannot normalize
    // result items or show them to users until the team shares its response schema.
    return data;
  } catch {
    throw new Error("Knowledge base returned invalid JSON");
  }
}
