import test from "node:test";
import assert from "node:assert/strict";
import { reviewedPlanningRecords } from "../lib/tourism/evidence-fallback.js";
import { CHINA_TOURISM_FAQS } from "../data/china-tourism-faq.js";

// This helper is a small deterministic planning convenience, not an intent
// classifier. The route must apply its safety checks before invoking it.
for (const [language, message] of [
  ["en", "Plan a relaxing Hangzhou day combining visitor payments and food allergies."],
  ["zh", "请综合建议杭州轻松行程、游客支付与食物过敏注意事项。"]
]) test(`reviewed planning composes approved Hangzhou, payment and allergy records in ${language}`, () => {
  const records = reviewedPlanningRecords(message, CHINA_TOURISM_FAQS);
  assert.deepEqual(records.map((record) => record.id), ["CN062", "CN014", "CN054"]);
  assert.ok(records.every((record) => CHINA_TOURISM_FAQS.includes(record)), "No new answer is generated or copied from a different bank");
});

for (const [language, message] of [
  ["en", "Plan a first trip to China combining wheelchair accessibility with an elderly visitor's pace."],
  ["zh", "第一次中国旅行，请综合建议无障碍参观与老人的行程节奏。"]
]) test(`reviewed planning combines accessibility, older visitors and first-visit guidance in ${language}`, () => {
  assert.deepEqual(reviewedPlanningRecords(message, CHINA_TOURISM_FAQS).map((record) => record.id), ["CN086", "CN087", "CN001"]);
});

test("planning never fills missing records by reaching into a global bank", () => {
  const message = "Plan a relaxing Hangzhou day combining payments and food allergies.";
  const customBank = [{ id: "MUSEUM_ONE", answer_en: "Private museum knowledge" }];
  assert.deepEqual(reviewedPlanningRecords(message, customBank), []);
  assert.deepEqual(reviewedPlanningRecords(message, CHINA_TOURISM_FAQS.filter((record) => record.id !== "CN054")), []);
  assert.deepEqual(reviewedPlanningRecords(message, []), []);
});

test("single-topic questions stay on the existing FAQ path rather than adding unrelated planning records", () => {
  for (const message of ["Plan payment advice for travel in China.", "Plan a relaxing Hangzhou day.",
    "请建议中国旅行的支付方式。", "请给我中国旅行无障碍参观建议。"] ) {
    assert.deepEqual(reviewedPlanningRecords(message, CHINA_TOURISM_FAQS), [], message);
  }
});

test("non-tourism inputs and ordinary non-planning questions do not trigger the reviewed planner", () => {
  for (const message of ["Combine payment and allergy systems for an elderly first-time programmer.",
    "Plan a trip to Paris with wheelchair access and payments.", "How are allergies and payment systems related?",
    "请综合支付和食物过敏的信息。", "What payment methods and allergy information exist in China?"]) {
    assert.deepEqual(reviewedPlanningRecords(message, CHINA_TOURISM_FAQS), [], message);
  }
});

test("reviewed planner limits the composition to three existing records without mutating the bank", () => {
  const before = JSON.stringify(CHINA_TOURISM_FAQS);
  const result = reviewedPlanningRecords("Combine a first trip for an elderly wheelchair user in China: a relaxing Hangzhou day, payments and allergies.", CHINA_TOURISM_FAQS);
  assert.deepEqual(result.map((record) => record.id), ["CN062", "CN014", "CN054"]);
  assert.equal(JSON.stringify(CHINA_TOURISM_FAQS), before);
});

test("negated planning topics cannot become unrelated approved advice", () => {
  for (const message of ["For my first trip to China, I am not asking about payments or allergies; tell me about the museum's Ming vase.",
    "Combine travel in China, but do not discuss payments or allergies.", "请综合中国旅行建议，但不要介绍支付和食物过敏。"])
    assert.deepEqual(reviewedPlanningRecords(message, CHINA_TOURISM_FAQS), []);
});
