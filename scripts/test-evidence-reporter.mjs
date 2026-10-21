// Node's machine-readable test events; no model/API credentials are required.
// Usage: node --test --test-reporter=./scripts/test-evidence-reporter.mjs
//   --test-reporter-destination=reports/assertions.jsonl tests/*.test.mjs
export default async function* evidenceReporter(events) {
  for await (const event of events) {
    yield JSON.stringify(event, (_key, value) => {
      if (value instanceof Error) return { name: value.name, message: value.message, stack: value.stack, ...value };
      return typeof value === "bigint" ? value.toString() : value;
    }) + "\n";
  }
}
