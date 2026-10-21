import test from "node:test";
import assert from "node:assert/strict";
import { REDTEAM_CASES } from "./fixtures/redteam-cases.mjs";
import { runEvaluation } from "../scripts/redteam.mjs";

test("red-team corpus preserves 180 unique fixed-label supplemental cases",()=>{
  assert.equal(REDTEAM_CASES.length,180);
  assert.equal(new Set(REDTEAM_CASES.map(c=>c.id)).size,180);
  assert.equal(REDTEAM_CASES.filter(c=>c.kind === "attack").length,140);
  assert.equal(REDTEAM_CASES.filter(c=>c.kind === "off_topic").length,20);
  assert.equal(REDTEAM_CASES.filter(c=>c.kind === "benign").length,20);
  assert.ok(REDTEAM_CASES.every(c=>c.rationale && c.technique && c.owasp && c.expected_statuses.length));
});

// Run serially because env/fetch are intentionally scoped process-level fixtures.
// Every case gets its own Node test result so failures remain individually visible.
for (const mode of ["offline","provider-adversarial"]) {
  const evidence = await runEvaluation({mode,revisionLabel:"regression-test"});
  for (const row of evidence.results) test(`${mode}: ${row.id} ${row.family} ${row.language}`,()=>{
    assert.equal(row.pass,true,`${row.message}\n${row.failure_reasons.join("\n")}\nActual response: ${JSON.stringify(row.response_body)}`);
  });
}
