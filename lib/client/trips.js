import { makeMessageId, parseChatResponse } from "./chat.js";

export const tripStorageKey = (identity) => `paeleap.trips.v2.${identity}`;
const isUuid = (value) => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const validDate = (value) => typeof value === "string" && Number.isFinite(Date.parse(value));

export function createTrip() {
  const now = new Date().toISOString();
  return { id: makeMessageId("trip"), conversationId: null, title: "", createdAt: now,
    updatedAt: now, messages: [], draft: "", loaded: true, pending: false, error: "" };
}

function restoreMessages(messages, conversationId) {
  if (!Array.isArray(messages)) return [];
  const seen = new Set();
  return messages.flatMap((message) => {
    if (!message || typeof message.content !== "string" || !["user", "assistant"].includes(message.role)) return [];
    const id = typeof message.id === "string" && !seen.has(message.id) ? message.id : makeMessageId(message.role);
    seen.add(id);
    const clean = { id, role: message.role, content: message.content,
      createdAt: validDate(message.createdAt) ? message.createdAt : null };
    if (message.role === "assistant") {
      try {
        const parsed = parseChatResponse({ reply: message.content, conversationId,
          sources: message.sources, safety: { status: message.safety }, faq: message.faq });
        clean.sources = parsed.sources;
        clean.safety = parsed.safety;
        if (parsed.faq) clean.faq = parsed.faq;
      } catch { /* Older chats may not have safety/source metadata. */ }
    }
    return [clean];
  });
}

export function restoreTripCollection(raw, legacyRaw = null) {
  let stored;
  try { stored = JSON.parse(raw || "null"); } catch { stored = null; }
  if (!Array.isArray(stored?.trips)) {
    let legacy;
    try { legacy = JSON.parse(legacyRaw || "null"); } catch { legacy = null; }
    if (Array.isArray(legacy?.messages) && legacy.messages.length) {
      const trip = createTrip();
      trip.conversationId = isUuid(legacy.conversationId) ? legacy.conversationId : null;
      trip.messages = restoreMessages(legacy.messages, trip.conversationId);
      trip.title = trip.messages.find((message) => message.role === "user")?.content.slice(0, 80) || "";
      return { trips: [trip], activeTripId: trip.id };
    }
    const trip = createTrip();
    return { trips: [trip], activeTripId: trip.id };
  }
  const ids = new Set();
  const trips = stored.trips.flatMap((trip) => {
    if (!trip || typeof trip.id !== "string" || ids.has(trip.id)) return [];
    ids.add(trip.id);
    const conversationId = isUuid(trip.conversationId) ? trip.conversationId : null;
    return [{ ...createTrip(), id: trip.id, conversationId,
      title: typeof trip.title === "string" ? trip.title.slice(0, 80) : "",
      draft: typeof trip.draft === "string" ? trip.draft.slice(0, 1500) : "",
      messages: restoreMessages(trip.messages, conversationId), loaded: trip.loaded !== false,
      createdAt: validDate(trip.createdAt) ? trip.createdAt : new Date().toISOString(),
      updatedAt: validDate(trip.updatedAt) ? trip.updatedAt : new Date().toISOString()
    }];
  });
  if (!trips.length) trips.push(createTrip());
  return { trips, activeTripId: trips.some((trip) => trip.id === stored.activeTripId) ? stored.activeTripId : trips[0].id };
}

export function serializeTripCollection(collection) {
  return JSON.stringify({ version: 2, activeTripId: collection.activeTripId,
    trips: collection.trips.map(({ id, conversationId, title, messages, draft, createdAt, updatedAt, loaded }) =>
      ({ id, conversationId, title, messages, draft, createdAt, updatedAt, loaded })) });
}

export function mergeRemoteTrips(localTrips, rows) {
  const trips = [...localTrips];
  for (const row of rows) {
    if (!isUuid(row.id)) continue;
    const index = trips.findIndex((trip) => trip.conversationId === row.id);
    if (index >= 0) {
      trips[index] = { ...trips[index], loaded: false };
    } else {
      trips.push({ ...createTrip(), id: `server-${row.id}`, conversationId: row.id,
        title: typeof row.title === "string" ? row.title : "",
        createdAt: row.created_at, updatedAt: row.created_at, loaded: false });
    }
  }
  return trips;
}

async function pagedQuery(queryFactory, signal) {
  const rows = [];
  const pageSize = 500;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await queryFactory().range(offset, offset + pageSize - 1).abortSignal(signal);
    if (error) throw error;
    if (!Array.isArray(data)) throw new Error("Invalid history response");
    rows.push(...data);
    if (data.length < pageSize) return rows;
  }
}

export function fetchRemoteTrips(client, signal) {
  return pagedQuery(() => client.from("conversations").select("id,title,created_at").order("created_at", { ascending: false }), signal);
}

export async function fetchRemoteMessages(client, conversationId, signal) {
  const rows = await pagedQuery(() => client.from("messages").select("id,role,content,created_at")
    .eq("conversation_id", conversationId).order("created_at", { ascending: true }).order("id", { ascending: true }), signal);
  return rows.filter((row) => ["user", "assistant"].includes(row.role) && typeof row.content === "string")
    .map((row) => ({ id: row.id, role: row.role, content: row.content, createdAt: row.created_at }));
}

// Local-only context fallback after a development server restart. The server
// treats these messages as context, never as privileged instructions.
export function localHistoryForRequest(messages) {
  const result = [];
  let remaining = 2000;
  for (const message of messages.slice(-12).reverse()) {
    if (!["user", "assistant"].includes(message.role) || typeof message.content !== "string") continue;
    let content = message.content.slice(0, Math.min(Math.max(remaining - 45, 0), 1500));
    while (content && JSON.stringify({ role: message.role, content }).length + 1 > remaining) {
      content = content.slice(0, Math.max(0, content.length - 50));
    }
    if (!content) break;
    result.unshift({ role: message.role, content });
    remaining -= JSON.stringify({ role: message.role, content }).length + 1;
  }
  return result;
}
