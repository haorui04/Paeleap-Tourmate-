import { makeMessageId, parseChatResponse } from "./chat.js";
import { DEFAULT_PERSONA_ID, isPersonaId } from "./personas.js";

export const tripStorageKey = (identity, personaId = DEFAULT_PERSONA_ID) => {
  if (!isPersonaId(personaId)) throw new Error("Invalid assistant profile.");
  return `paeleap.trips.v3.${encodeURIComponent(identity)}.${personaId}`;
};
const isUuid = (value) => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const validDate = (value) => typeof value === "string" && Number.isFinite(Date.parse(value));

export function createTrip(personaId = DEFAULT_PERSONA_ID) {
  const now = new Date().toISOString();
  return { id: makeMessageId("trip"), personaId, conversationId: null, title: "", createdAt: now,
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
          sources: message.sources, safety: { status: message.safety }, faq: message.faq, ai: message.ai, persona: message.persona });
        clean.sources = parsed.sources;
        clean.safety = parsed.safety;
        if (parsed.faq) clean.faq = parsed.faq;
        if (parsed.ai) clean.ai = parsed.ai;
        if (parsed.persona) clean.persona = parsed.persona;
      } catch { /* Older chats may not have safety/source metadata. */ }
    }
    return [clean];
  });
}

export function restoreTripCollection(raw, legacyRaw = null, personaId = DEFAULT_PERSONA_ID) {
  let stored;
  try { stored = JSON.parse(raw || "null"); } catch { stored = null; }
  if (!Array.isArray(stored?.trips)) {
    let legacy;
    try { legacy = JSON.parse(legacyRaw || "null"); } catch { legacy = null; }
    if (personaId === DEFAULT_PERSONA_ID && Array.isArray(legacy?.messages) && legacy.messages.length) {
      const trip = createTrip(personaId);
      trip.conversationId = isUuid(legacy.conversationId) ? legacy.conversationId : null;
      trip.messages = restoreMessages(legacy.messages, trip.conversationId);
      trip.title = trip.messages.find((message) => message.role === "user")?.content.slice(0, 80) || "";
      return { trips: [trip], activeTripId: trip.id };
    }
    const trip = createTrip(personaId);
    return { trips: [trip], activeTripId: trip.id };
  }
  const ids = new Set();
  const trips = stored.trips.flatMap((trip) => {
    if (!trip || typeof trip.id !== "string" || ids.has(trip.id) ||
      (trip.personaId || DEFAULT_PERSONA_ID) !== personaId) return [];
    ids.add(trip.id);
    const conversationId = isUuid(trip.conversationId) ? trip.conversationId : null;
    return [{ ...createTrip(personaId), id: trip.id, conversationId,
      title: typeof trip.title === "string" ? trip.title.slice(0, 80) : "",
      draft: typeof trip.draft === "string" ? trip.draft.slice(0, 1500) : "",
      messages: restoreMessages(trip.messages, conversationId), loaded: trip.loaded !== false,
      createdAt: validDate(trip.createdAt) ? trip.createdAt : new Date().toISOString(),
      updatedAt: validDate(trip.updatedAt) ? trip.updatedAt : new Date().toISOString()
    }];
  });
  if (!trips.length) trips.push(createTrip(personaId));
  return { trips, activeTripId: trips.some((trip) => trip.id === stored.activeTripId) ? stored.activeTripId : trips[0].id };
}

export function serializeTripCollection(collection, { includeMessages = true } = {}) {
  return JSON.stringify({ version: 3, activeTripId: collection.activeTripId,
    trips: collection.trips.map(({ id, personaId = DEFAULT_PERSONA_ID, conversationId, title, messages, draft, createdAt, updatedAt, loaded }) =>
      ({ id, personaId, conversationId, title, messages: includeMessages ? messages : [], draft, createdAt, updatedAt, loaded: includeMessages ? loaded : !conversationId })) });
}

export function mergeRemoteTrips(localTrips, rows, personaId = DEFAULT_PERSONA_ID) {
  const remoteIds = new Set(rows.map(row => row.id));
  // Completed remote-backed chats missing from the authoritative list were
  // deleted (possibly on another device). Keep drafts and in-flight creations.
  const trips = localTrips.filter((trip) => (trip.personaId || DEFAULT_PERSONA_ID) === personaId &&
    (!trip.conversationId || trip.pending || remoteIds.has(trip.conversationId)));
  for (const row of rows) {
    if (!isUuid(row.id) || (row.persona_id || DEFAULT_PERSONA_ID) !== personaId) continue;
    const index = trips.findIndex((trip) => trip.conversationId === row.id);
    if (index >= 0) {
      trips[index] = { ...trips[index], loaded: trips[index].pending ? trips[index].loaded : false };
    } else {
      trips.push({ ...createTrip(personaId), id: `server-${row.id}`, conversationId: row.id,
        title: typeof row.title === "string" ? row.title : "",
        createdAt: row.created_at, updatedAt: row.created_at, loaded: false });
    }
  }
  return trips;
}

export function removeTripFromCollection(collection, tripId, personaId = DEFAULT_PERSONA_ID) {
  if (!collection.trips.some(trip => trip.id === tripId)) return collection;
  const trips = collection.trips.filter(trip => trip.id !== tripId);
  if (!trips.length) trips.push(createTrip(personaId));
  return { ...collection, trips, activeTripId: trips.some(trip => trip.id === collection.activeTripId) ? collection.activeTripId : trips[0].id };
}

export async function deleteRemoteTrip(client, conversationId, fetchImpl = fetch) {
  if (!isUuid(conversationId)) throw new Error("Invalid conversation");
  const { data } = await client.auth.getSession();
  if (!data.session?.access_token) throw new Error("Session expired");
  const response = await fetchImpl(`/api/conversations/${conversationId}`, { method: "DELETE",
    headers: { Authorization: `Bearer ${data.session.access_token}` }, signal: AbortSignal.timeout(15000), cache: "no-store" });
  // Already deleted on another tab/device is a successful local cleanup too.
  if (response.status === 404) return;
  if (!response.ok) throw new Error("Delete failed");
  const result = await response.json();
  if (result.deleted !== true) throw new Error("Invalid delete response");
}

export async function createRemoteTrip(client, { id, userId, title, personaId, personaVersion }) {
  if (!isUuid(id) || !isUuid(userId) || !isPersonaId(personaId) || !Number.isInteger(personaVersion) || personaVersion < 1) throw new Error("Invalid conversation");
  const { error } = await client.from("conversations").insert({ id, user_id: userId, title: title.slice(0, 80),
    persona_id: personaId, persona_version: personaVersion }).abortSignal(AbortSignal.timeout(15000));
  if (error) {
    const failure = new Error("Conversation could not be created");
    failure.code = "conversation_create";
    // Keep authentication failures actionable without exposing database errors.
    if ([401, 403].includes(error.status)) failure.status = error.status;
    throw failure;
  }
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

export function fetchRemoteTrips(client, signal, personaId = DEFAULT_PERSONA_ID) {
  if (!isPersonaId(personaId)) throw new Error("Invalid assistant profile.");
  return pagedQuery(() => client.from("conversations").select("id,title,created_at,persona_id,persona_version")
    .eq("persona_id", personaId).order("created_at", { ascending: false }), signal);
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
