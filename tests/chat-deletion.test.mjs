import test from "node:test";
import assert from "node:assert/strict";
import { DELETE } from "../app/api/conversations/[id]/route.js";
import { deleteRemoteTrip, removeTripFromCollection, mergeRemoteTrips, createTrip, createRemoteTrip, serializeTripCollection } from "../lib/client/trips.js";

const ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const USER = "11111111-1111-4111-8111-111111111111";
function fixture(t, { expired = false, owned = true, outage = false } = {}) {
  const env = { SUPABASE_URL: "https://deletion.invalid", SUPABASE_PUBLISHABLE_KEY: "SYNTHETIC_PUBLIC", SUPABASE_SERVICE_ROLE_KEY: "SYNTHETIC_SERVICE" };
  const saved = Object.fromEntries(Object.keys(env).map(key => [key, process.env[key]])); Object.assign(process.env, env);
  t.after(() => { for (const [key, value] of Object.entries(saved)) value === undefined ? delete process.env[key] : process.env[key] = value; });
  const calls = [];
  t.mock.method(globalThis, "fetch", async (address, init) => {
    const url = new URL(address); calls.push({ url, init });
    assert.equal(url.origin, "https://deletion.invalid");
    if (url.pathname === "/auth/v1/user") return Response.json({ id: USER }, { status: expired ? 401 : 200 });
    assert.equal(url.pathname, "/rest/v1/conversations"); assert.equal(init.method, "DELETE");
    assert.equal(url.searchParams.get("id"), "eq." + ID); assert.equal(url.searchParams.get("user_id"), "eq." + USER);
    assert.equal(url.searchParams.get("select"), "id"); assert.equal(init.headers.Prefer, "return=representation");
    if (outage) throw new Error("SYNTHETIC_PRIVATE_DATABASE_ERROR");
    return Response.json(owned ? [{ id: ID }] : []);
  });
  return calls;
}
const request = (headers = { Authorization: "Bearer SYNTHETIC_VISITOR" }) => new Request(`https://app.invalid/api/conversations/${ID}`, { method: "DELETE", headers });
const params = (id = ID) => ({ params: Promise.resolve({ id }) });

test("authenticated deletion filters owner and ID in the atomic DELETE", async t => {
  const calls = fixture(t); const response = await DELETE(request(), params());
  assert.equal(response.status, 200); assert.deepEqual(await response.json(), { deleted: true });
  assert.equal(calls.length, 2); assert.equal(response.headers.get("cache-control"), "no-store");
});
test("missing session and malformed IDs make no database requests", async t => {
  const calls = fixture(t);
  assert.equal((await DELETE(request({}), params())).status, 401);
  assert.equal((await DELETE(request(), params("id=eq.other"))).status, 400);
  assert.equal((await DELETE(request({ Authorization: "Bearer " + "a".repeat(8200) }), params())).status, 401);
  assert.equal(calls.length, 0);
});
test("expired visitor tokens cannot reach DELETE", async t => {
  const calls = fixture(t, { expired: true }); assert.equal((await DELETE(request(), params())).status, 401);
  assert.equal(calls.length, 1);
});
test("foreign origin cannot trigger deletion even with an attached token", async t => {
  const calls = fixture(t);
  assert.equal((await DELETE(request({ Authorization: "Bearer SYNTHETIC_VISITOR", Origin: "https://evil.invalid" }), params())).status, 403);
  assert.equal(calls.length, 0);
});
test("unowned and absent conversation IDs receive the same 404", async t => {
  fixture(t, { owned: false }); const response = await DELETE(request(), params());
  assert.equal(response.status, 404); assert.deepEqual(await response.json(), { error: "Conversation not found" });
});
test("database failure is reported without leaking raw errors or claiming success", async t => {
  fixture(t, { outage: true }); const response = await DELETE(request(), params());
  assert.equal(response.status, 503); assert.doesNotMatch(await response.text(), /SYNTHETIC_PRIVATE|SYNTHETIC_SERVICE/);
});

test("removing a trip clears its messages/draft from serialized cache and selects a remaining trip", () => {
  const a = { ...createTrip(), messages: [{ role: "user", content: "DELETE_ME" }], draft: "DELETE_DRAFT", conversationId: ID };
  const b = { ...createTrip(), draft: "KEEP_DRAFT" };
  const next = removeTripFromCollection({ owner: "a", trips: [a, b], activeTripId: a.id }, a.id);
  assert.deepEqual(next.trips, [b]); assert.equal(next.activeTripId, b.id);
  assert.doesNotMatch(serializeTripCollection(next), /DELETE_ME|DELETE_DRAFT|aaaaaaaa/);
  const empty = removeTripFromCollection(next, b.id);
  assert.equal(empty.trips.length, 1); assert.equal(empty.trips[0].conversationId, null); assert.equal(empty.trips[0].messages.length, 0);
});
test("deletion on another device does not resurrect from stale cache; pending creations survive sync", () => {
  const stale = { ...createTrip(), conversationId: ID };
  assert.equal(mergeRemoteTrips([stale], []).length, 0);
  assert.equal(mergeRemoteTrips([{ ...stale, pending: true }], []).length, 1);
  assert.equal(mergeRemoteTrips([createTrip()], []).length, 1);
});
test("client deletes only the selected ID with a fresh session token", async () => {
  const client = { auth: { async getSession() { return { data: { session: { access_token: "SYNTHETIC_TOKEN" } } }; } } };
  await deleteRemoteTrip(client, ID, async (url, init) => {
    assert.equal(url, `/api/conversations/${ID}`); assert.equal(init.method, "DELETE");
    assert.deepEqual(init.headers, { Authorization: "Bearer SYNTHETIC_TOKEN" }); assert.ok(init.signal);
    return Response.json({ deleted: true });
  });
  await deleteRemoteTrip(client, ID, async () => Response.json({}, { status: 404 }));
  await assert.rejects(deleteRemoteTrip(client, ID, async () => Response.json({}, { status: 503 })));
  await assert.rejects(deleteRemoteTrip(client, "invalid", async () => { throw new Error("Must not call"); }));
});
test("new remote chat has a known owner/profile-bound UUID before generation", async () => {
  const client = { from(table) { assert.equal(table, "conversations"); return { insert(row) {
    assert.deepEqual(row, { id: ID, user_id: USER, title: "Travel", persona_id: "tourmate", persona_version: 1 });
    return { async abortSignal(signal) { assert.ok(signal); return { error: null }; } };
  } }; } };
  await createRemoteTrip(client, { id: ID, userId: USER, title: "Travel", personaId: "tourmate", personaVersion: 1 });
});
