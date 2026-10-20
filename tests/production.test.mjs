import test from "node:test";
import assert from "node:assert/strict";
import { getFaqBank } from "../lib/db/faq.js";
import { shortlistFaqs } from "../lib/tourism/faq-matching.js";
import { CHINA_TOURISM_FAQS } from "../data/china-tourism-faq.js";
import { serializeTripCollection, restoreTripCollection, createTrip } from "../lib/client/trips.js";
import { GET } from "../app/api/status/route.js";

test("production requires persistent Supabase FAQ database and refuses local sqlite", async (t) => {
  const before = { NODE_ENV: process.env.NODE_ENV, FAQ_BANK_SOURCE: process.env.FAQ_BANK_SOURCE };
  t.after(() => { for (const [k,v] of Object.entries(before)) v === undefined ? delete process.env[k] : process.env[k] = v; });
  process.env.NODE_ENV = "production";
  process.env.FAQ_BANK_SOURCE = "local";
  await assert.rejects(getFaqBank(), /production requires Supabase/);
  const status = await GET();
  assert.equal(status.status, 503);
  assert.equal((await status.json()).status, "unconfigured");
});

test("FAQ model receives at most 12 candidates while exact question stays available", () => {
  const exact = shortlistFaqs(CHINA_TOURISM_FAQS[60].question_en, CHINA_TOURISM_FAQS);
  assert.deepEqual(exact.map(x => x.id), ["CN061"]);
  const candidates = shortlistFaqs("how do I book a train ticket in China", CHINA_TOURISM_FAQS);
  assert.ok(candidates.length > 0 && candidates.length <= 12);
  assert.equal(shortlistFaqs("hello", CHINA_TOURISM_FAQS).length, 0);
});

test("authenticated history persisted in browser excludes transcript but preserves trip IDs", () => {
  const trip = createTrip();
  trip.conversationId = "550e8400-e29b-41d4-a716-446655440000";
  trip.messages = [{role:"user",content:"PRIVATE: my personal itinerary"}];
  const raw = serializeTripCollection({trips:[trip],activeTripId:trip.id},{includeMessages:false});
  assert.doesNotMatch(raw,/PRIVATE/);
  const restored = restoreTripCollection(raw);
  assert.equal(restored.trips[0].conversationId, trip.conversationId);
  assert.deepEqual(restored.trips[0].messages,[]);
});
