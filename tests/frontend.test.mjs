import test from "node:test";
import assert from "node:assert/strict";
import { buildChatBody, parseChatResponse, chatErrorMessage } from "../lib/client/chat.js";

const conversationId = "550e8400-e29b-41d4-a716-446655440000";

test("frontend reuses the backend conversation UUID and language", () => {
  assert.deepEqual(buildChatBody({ message: "  西湖  ", conversationId, language: "zh" }), {
    message: "西湖", conversationId, language: "zh"
  });
  assert.equal(buildChatBody({ message: "Hello", language: "en" }).conversationId, null);
});

test("frontend handles every documented safety outcome and removes unsafe sources", () => {
  for (const status of ["allowed", "blocked", "emergency", "redirected", "sanitized"]) {
    const result = parseChatResponse({ reply: "A travel response", conversationId,
      safety: { status }, sources: [
        { name: "UNESCO", url: "https://whc.unesco.org/en/list/1334" },
        { name: "Unsafe", url: "javascript:alert(1)" },
        { name: "Invalid", url: ":bad" }
      ] });
    assert.equal(result.safety, status);
    assert.equal(result.sources.length, status === "allowed" ? 1 : 0);
  }
});

test("invalid server contracts cannot poison the next chat request", () => {
  const payload = { reply: "Hello", conversationId, sources: [], safety: { status: "allowed" } };
  assert.throws(() => parseChatResponse({ ...payload, conversationId: "not-a-uuid" }));
  assert.throws(() => parseChatResponse({ ...payload, reply: " " }));
  assert.throws(() => parseChatResponse({ ...payload, safety: { status: "unknown" } }));
});

test("documented HTTP errors have usable English and Chinese messages", () => {
  for (const status of [400, 401, 404, 413, 429, 502, 503, 504]) {
    assert.ok(chatErrorMessage(status, "en").length > 10);
    assert.match(chatErrorMessage(status, "zh"), /[\u3400-\u9fff]/);
  }
});

test("client contract failures are distinguished from a network failure", () => {
  let failure;
  try { parseChatResponse({ reply: "Hello" }); } catch (error) { failure = error; }
  assert.equal(failure.code, "invalid_response");
  assert.match(chatErrorMessage(undefined, "en", "", failure.code), /unreadable chat response/);
  assert.doesNotMatch(chatErrorMessage(undefined, "en", "", "conversation_create"), /Check your connection/);
  assert.match(chatErrorMessage(401, "en", "", "conversation_create"), /session has expired/);
  assert.match(chatErrorMessage(undefined, "zh", "", "conversation_create"), /创建/);
  assert.match(chatErrorMessage(undefined, "en"), /Check your connection/);
});
