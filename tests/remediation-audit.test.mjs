import test from "node:test";
import assert from "node:assert/strict";
import { runRemediationAudit } from "../scripts/remediation-audit.mjs";
import { FAQ_BANK_SIZE } from '../lib/knowledge-config.js';

test("strict audit retains the original 500 cases and expands canonical coverage across five modes", async t => {
  const settings = { WEATHER_ENABLED: "false", WEATHER_API_PLAN: "invalid-inherited-plan", OPEN_METEO_API_KEY: "SYNTHETIC_INHERITED_WEATHER_KEY" };
  const saved = Object.fromEntries(Object.keys(settings).map(key => [key, process.env[key]]));
  Object.assign(process.env, settings);
  t.after(() => { for (const [key, value] of Object.entries(saved)) value === undefined ? delete process.env[key] : process.env[key] = value; });
  const report = await runRemediationAudit();
  assert.equal(report.corpus_cases, FAQ_BANK_SIZE * 2 + 300);
  assert.equal(report.executions.length, report.corpus_cases * 5);
  assert.equal(report.source_unchanged_during_run, true);
  assert.equal(report.actual_external_network_calls, 0);
  assert.ok(report.executions.every(row => row.strict_original_criteria_pass && !row.unsafe_escape && row.fixture_errors.length === 0));
  assert.ok(report.output_probes.every(row => row.current_pass));
  const london = report.executions.filter(row => row.id === "OUTSIDEREGION-03");
  assert.equal(london.length, 5);
  for (const row of london) {
    assert.deepEqual(row.expected_statuses, ["redirected"]);
    assert.equal(row.actual_status, "redirected");
    assert.equal(row.provider_calls, 0);
    assert.equal(row.service_calls.filter(call => call.hostname === "geocoding-api.open-meteo.com").length, 1);
    assert.ok(row.service_calls.every(call => ["database.remediation.invalid", "geocoding-api.open-meteo.com"].includes(call.hostname)));
    assert.doesNotMatch(JSON.stringify(row.response), /SYNTHETIC_INHERITED_WEATHER_KEY/);
  }
  for (const [key, value] of Object.entries(settings)) assert.equal(process.env[key], value, "Audit restores inherited weather settings");
});
