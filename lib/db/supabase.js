/**
 * Minimal server-side Supabase REST adapter.
 * User requests are authenticated with Supabase Auth and RLS.
 * Message writes and quota calls use a server-only service_role key only AFTER ownership verification.
 * This file must never be imported into a client component.
 */
import { hasConfiguredValue } from "../config.js";

function config() {
  const { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (![SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SERVICE_ROLE_KEY].every(hasConfiguredValue)) {
    throw new Error("Supabase is not configured");
  }
  const base = new URL(SUPABASE_URL);
  if (base.protocol !== "https:" && !(base.protocol === "http:" && ["localhost", "127.0.0.1"].includes(base.hostname))) {
    throw new Error("SUPABASE_URL must use HTTPS");
  }
  return { base: base.origin, publishable: SUPABASE_PUBLISHABLE_KEY, service: SUPABASE_SERVICE_ROLE_KEY };
}

export async function authenticate(accessToken) {
  if (!accessToken || typeof accessToken !== "string") return null;
  const { base, publishable } = config();
  const response = await fetch(base + "/auth/v1/user", {
    headers: { apikey: publishable, Authorization: "Bearer " + accessToken },
    cache: "no-store",
    signal: AbortSignal.timeout(10000)
  });
  if (!response.ok) return null;
  const user = await response.json();
  return typeof user.id === "string" ? { id: user.id, token: accessToken } : null;
}

async function rest(path, { token, admin = false, method = "GET", data, prefer } = {}) {
  const { base, publishable, service } = config();
  const key = admin ? service : publishable;
  const bearer = admin ? service : token;
  if (!bearer) throw new Error("Missing database access token");
  const headers = { apikey: key, Authorization: "Bearer " + bearer };
  if (data !== undefined) headers["Content-Type"] = "application/json";
  if (prefer) headers.Prefer = prefer;
  const res = await fetch(base + "/rest/v1/" + path, {
    method, headers,
    body: data === undefined ? undefined : JSON.stringify(data),
    signal: AbortSignal.timeout(10000),
    cache: "no-store"
  });
  if (!res.ok) throw new Error("Database request failed: HTTP " + res.status);
  if (res.status === 204) return null;
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

export async function ensureConversation(user, requestedId, title) {
  if (requestedId) {
    // Row Level Security restricts the lookup to the requesting user.
    const rows = await rest("conversations?select=id&id=eq." + encodeURIComponent(requestedId), { token: user.token });
    return Array.isArray(rows) && rows.length === 1 ? rows[0].id : null;
  }
  const rows = await rest("conversations?select=id", {
    token: user.token, method: "POST",
    data: { user_id: user.id, title: title.slice(0, 80) },
    prefer: "return=representation"
  });
  if (!Array.isArray(rows) || !rows[0]?.id) throw new Error("Failed to create conversation");
  return rows[0].id;
}

export async function getRecentMessages(user, conversationId) {
  const query = "messages?select=role,content&conversation_id=eq." +
    encodeURIComponent(conversationId) + "&order=created_at.desc&limit=12";
  const rows = await rest(query, { token: user.token });
  return (Array.isArray(rows) ? rows : []).reverse();
}

export async function storeExchange(conversationId, userMessage, assistantMessage) {
  // Both rows otherwise receive the same transaction timestamp, losing turn order.
  const createdAt = Date.now();
  await rest("messages", {
    admin: true, method: "POST",
    data: [
      { conversation_id: conversationId, role: "user", content: userMessage, created_at: new Date(createdAt).toISOString() },
      { conversation_id: conversationId, role: "assistant", content: assistantMessage, created_at: new Date(createdAt + 1).toISOString() }
    ],
    prefer: "return=minimal"
  });
}

export async function consumeQuota(userId) {
  const result = await rest("rpc/consume_chat_quota", {
    admin: true, method: "POST",
    data: { p_user_id: userId, p_max_requests: 6 }
  });
  return result === true;
}
