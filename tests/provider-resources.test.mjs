import test from "node:test";
import assert from "node:assert/strict";
import { requestModelText, chatEndpoint, responsesFaqPayload } from "../lib/ai/provider.js";

for (const protocol of ["responses", "chat_completions", "anthropic"]) {
  test(`${protocol} evidence selector has a provider token cap and refuses redirects`, async () => {
    const result = await requestModelText({ baseUrl: "https://provider.invalid/v1", key: "fake-test-only", model: "fixture",
      messages: [{ role: "user", content: "Return JSON" }], protocol, outputTokenLimit: 512,
      fetchImpl: async (_url, init) => {
        assert.equal(init.redirect, "error");
        const body = JSON.parse(init.body);
        assert.equal(body[protocol === "responses" ? "max_output_tokens" : "max_tokens"], 512);
        if (protocol === "responses") assert.equal(body.store, false);
        return Response.json(protocol === "anthropic"
          ? { type: "message", role: "assistant", stop_reason: "end_turn", content: [{ type: "text", text: "OK" }] }
          : { output_text: "OK" });
      } });
    assert.equal(result, "OK");
  });
}

test("oversized upstream streams are cancelled before parsing or logging their content", async () => {
  let cancelled = false;
  let pulls = 0;
  await assert.rejects(requestModelText({ baseUrl: "https://provider.invalid/v1", key: "fake", model: "fixture", messages: [],
    fetchImpl: async () => new Response(new ReadableStream({
      pull(controller) { pulls++; controller.enqueue(new Uint8Array(65536)); },
      cancel() { cancelled = true; }
    })) }), /invalid AI provider response/);
  assert.ok(cancelled);
  assert.ok(pulls <= 5);
});

test("invalid output-token settings and credential-bearing provider URLs fail closed", () => {
  for (const limit of [0, -1, 127, 2049, 1.1, "512"]) assert.throws(() => responsesFaqPayload({ model: "x", messages: [], outputTokenLimit: limit }));
  for (const url of ["https://user:password@provider.invalid/v1", "https://provider.invalid/v1#secret"]) assert.throws(() => chatEndpoint(url));
});
