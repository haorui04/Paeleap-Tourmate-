import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_PERSONA_ID, ENTRY_PERSONA_ID, MAX_PERSONA_FILE_BYTES, personaIdFromSearch, parsePublicPersona,
  provenanceLabel, readPersonaPackage } from "../lib/client/personas.js";
import { buildChatBody, parseChatResponse } from "../lib/client/chat.js";
import { createTrip, tripStorageKey, restoreTripCollection, serializeTripCollection, mergeRemoteTrips, fetchRemoteTrips, createRemoteTrip } from "../lib/client/trips.js";

const conversationId = "550e8400-e29b-41d4-a716-446655440000";
const persona = { id: "deshou-rabbit", version: 1, name: { en: "Little De Rabbit", zh: "小德兔" },
  venue: { en: "De Shou Palace", zh: "德寿宫" }, greeting: { en: "I am your museum guide.", zh: "我是你的场馆导览助手。" }, tone: "child_friendly" };
const reply = { reply: "Museum guidance.", conversationId, safety: { status: "allowed" }, sources: [] };

test("public profile links select only a valid slug and never silently fall back on an invalid museum", () => {
  assert.equal(personaIdFromSearch(""), ENTRY_PERSONA_ID);
  assert.equal(personaIdFromSearch("?persona=tourmate"), DEFAULT_PERSONA_ID);
  assert.equal(personaIdFromSearch("?persona=deshou-rabbit"), "deshou-rabbit");
  for (const search of ["?persona=", "?persona=../tourmate", "?persona=DE-RABBIT", "?persona=%3Cscript%3E"]) {
    assert.throws(() => personaIdFromSearch(search));
  }
});

test("public profile parser admits only bounded bilingual display metadata, not internal role or knowledge", () => {
  const result = parsePublicPersona({ ...persona, role: { en: "Private role", zh: "内部角色" }, knowledge: [{ secret: "private" }] });
  assert.equal(result.name.zh, "小德兔");
  assert.equal(result.version, 1);
  assert.equal(result.role, undefined);
  assert.equal(result.knowledge, undefined);
  for (const invalid of [{ ...persona, id: "../secret" }, { ...persona, greeting: { en: "Hello" } },
    { ...persona, name: { en: "A".repeat(101), zh: "名字" } }, { ...persona, version: null }]) {
    assert.throws(() => parsePublicPersona(invalid));
  }
});

test("a public or restored persona can reserve a new chat using the same integer version contract", async () => {
  for (const version of [1, "1", 2, "2", 2147483647]) {
    const profile = parsePublicPersona({ ...persona, version });
    let inserted;
    const client = { from(table) {
      assert.equal(table, "conversations");
      return { insert(row) { inserted = row; return { async abortSignal() { return { error: null }; } }; } };
    } };
    await createRemoteTrip(client, { id: conversationId, userId: "11111111-1111-4111-8111-111111111111",
      title: "Who are you?", personaId: profile.id, personaVersion: profile.version });
    assert.equal(inserted.persona_version, Number(version));
    assert.equal(typeof inserted.persona_version, "number");
  }
  for (const version of [0, -1, 1.5, "", " 1", "01", "1e2", "1.5", "version-1", 2147483648, Infinity, true])
    assert.throws(() => parsePublicPersona({ ...persona, version }));
});

test("chat requests explicitly carry the selected profile and do not accept malformed IDs", () => {
  const body = buildChatBody({ message: "  Who are you? ", language: "en", personaId: persona.id });
  assert.deepEqual(body, { conversationId: null, message: "Who are you?", language: "en", personaId: persona.id });
  assert.throws(() => buildChatBody({ message: "Hello", personaId: "../admin" }));
});

test("response provenance preserves supported server modes and never translates arbitrary generation to verification", () => {
  for (const mode of ["persona_identity", "curated_evidence", "evidence_composition", "curated_faq", "curated_faq_fallback"]) {
    const parsed = parseChatResponse({ ...reply, persona, ai: { mode } });
    assert.deepEqual(parsed.ai, { mode });
    assert.equal(parsed.persona.id, persona.id);
    assert.ok(provenanceLabel(mode, "en"));
    assert.ok(provenanceLabel(mode, "zh"));
  }
  for (const mode of [undefined, "grounded_generation", "verified", "visitor_controlled"]) {
    const parsed = parseChatResponse({ ...reply, ai: { mode } });
    assert.equal(parsed.ai, undefined);
    assert.equal(provenanceLabel(mode), "");
  }
  assert.equal(parseChatResponse({ ...reply, ai: { mode: "curated_faq" }, safety: { status: "blocked" } }).ai, undefined);
});

test("source rendering rejects credential-bearing URLs as well as script and non-HTTPS links", () => {
  const parsed = parseChatResponse({ ...reply, sources: [
    { name: "Reference", url: "https://example.org/museum" },
    { name: "Credential", url: "https://key:secret@example.org" },
    { name: "Unsafe", url: "javascript:alert(1)" },
    { name: "Insecure", url: "http://example.org" }
  ] });
  assert.deepEqual(parsed.sources, [{ name: "Reference", url: "https://example.org/museum" }]);
});

test("local histories isolate the same visitor across different museums and account IDs", () => {
  assert.notEqual(tripStorageKey("visitor", "tourmate"), tripStorageKey("visitor", persona.id));
  assert.notEqual(tripStorageKey("visitor:a", "tourmate"), tripStorageKey("visitor", "a-tourmate"));
  const original = { ...createTrip(), conversationId, messages: [{ id: "user", role: "user", content: "Private trip", createdAt: null }] };
  const encoded = serializeTripCollection({ trips: [original], activeTripId: original.id });
  const isolated = restoreTripCollection(encoded, null, persona.id);
  assert.equal(isolated.trips.length, 1);
  assert.equal(isolated.trips[0].personaId, persona.id);
  assert.equal(isolated.trips[0].conversationId, null);
  assert.deepEqual(isolated.trips[0].messages, []);
  const legacy = JSON.stringify({ conversationId, messages: original.messages });
  assert.deepEqual(restoreTripCollection(null, legacy, persona.id).trips[0].messages, []);
});

test("museum history round trip retains identity, messages, provenance, and citations", () => {
  const assistant = { id: "reply", role: "assistant", content: reply.reply, createdAt: null,
    safety: "allowed", sources: [], ai: { mode: "evidence_composition" }, persona: parsePublicPersona(persona) };
  const trip = { ...createTrip(persona.id), conversationId, messages: [assistant] };
  const result = restoreTripCollection(serializeTripCollection({ trips: [trip], activeTripId: trip.id }), null, persona.id);
  assert.deepEqual(result.trips[0].messages, [assistant]);
  assert.equal(result.trips[0].personaId, persona.id);
});

test("reviewed planning provenance remains neutral and survives restoring local history", () => {
  assert.equal(provenanceLabel("curated_evidence", "en"), "Approved knowledge");
  assert.equal(provenanceLabel("curated_evidence", "zh"), "已发布资料");
  const assistant = { id: "planning-reply", role: "assistant", content: "Approved travel notes.", createdAt: null,
    safety: "allowed", sources: [], ai: { mode: "curated_evidence" } };
  const trip = { ...createTrip(), conversationId, messages: [assistant] };
  const restored = restoreTripCollection(serializeTripCollection({ trips: [trip], activeTripId: trip.id }));
  assert.deepEqual(restored.trips[0].messages[0].ai, { mode: "curated_evidence" });
});

test("remote rows from a different museum are discarded before merging", () => {
  const result = mergeRemoteTrips([], [
    { id: conversationId, persona_id: "tourmate", title: "Other museum" },
    { id: "550e8400-e29b-41d4-a716-446655440001", persona_id: persona.id, title: "This museum", created_at: "2026-10-23T00:00:00Z" }
  ], persona.id);
  assert.equal(result.length, 1);
  assert.equal(result[0].title, "This museum");
  assert.equal(result[0].personaId, persona.id);
});

test("remote history query adds a strict profile predicate in addition to database RLS", async () => {
  const filters = [];
  const client = { from(table) {
    assert.equal(table, "conversations");
    return { select() { return this; }, eq(column, value) { filters.push([column, value]); return this; },
      order() { return this; }, range() { return this; }, async abortSignal() { return { data: [], error: null }; } };
  } };
  await fetchRemoteTrips(client, new AbortController().signal, persona.id);
  assert.deepEqual(filters, [["persona_id", persona.id]]);
});

test("persona file preview validates size and extension before reading file contents", async () => {
  let reads = 0;
  const file = { name: "persona.json", size: MAX_PERSONA_FILE_BYTES + 1, async text() { reads += 1; return "{}"; } };
  await assert.rejects(() => readPersonaPackage(file), /2 MB/);
  await assert.rejects(() => readPersonaPackage({ ...file, size: 10, name: "persona.html" }), /\.json/);
  assert.equal(reads, 0);
});

test("persona package preview preserves the original package for independent server validation", async () => {
  const payload = { ...persona, role: { en: "Museum guide", zh: "场馆导览" }, scope: ["museum"], knowledge: [{ id: "DR001" }] };
  const result = await readPersonaPackage({ name: "profile.json", size: 1024, async text() { return JSON.stringify(payload); } });
  assert.equal(result.recordCount, 1);
  assert.deepEqual(result.payload, payload);
  assert.equal(result.persona.name.en, "Little De Rabbit");
  for (const content of ["not-json", "[]", JSON.stringify({ ...payload, knowledge: [] })]) {
    await assert.rejects(() => readPersonaPackage({ name: "profile.json", size: 20, async text() { return content; } }));
  }
});
