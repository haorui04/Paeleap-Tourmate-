import test from "node:test";
import assert from "node:assert/strict";
import { knowledgeBaseEndpoint, knowledgeBaseConfigured, searchKnowledgeBase } from "../lib/knowledge-base/client.js";

const env = {
  NODE_ENV: "test", KNOWLEDGE_BASE_ENABLED: "true",
  KNOWLEDGE_BASE_URL: "http://127.0.0.1:8765/api/search",
  KNOWLEDGE_BASE_API_KEY: "fake-test-secret"
};

test("knowledge-base client sends the team's exact POST body and X-API-Key header", async () => {
  let attempts = 0;
  const result = await searchKnowledgeBase({
    query: " 你的问题 ", env, topK: 5, museum: "",
    fetchImpl: async (url, init) => {
      attempts++;
      assert.equal(url, "http://127.0.0.1:8765/api/search");
      assert.equal(init.method, "POST");
      assert.equal(init.headers["X-API-Key"], "fake-test-secret");
      assert.equal(init.headers["Content-Type"], "application/json");
      assert.equal(init.cache, "no-store");
      assert.deepEqual(JSON.parse(init.body), { query: "你的问题", top_k: 5, museum: "" });
      return Response.json({results: [{id: "sample"}]});
    }
  });
  assert.equal(attempts, 1);
  assert.deepEqual(result, {results: [{id: "sample"}]});
});

test("adapter is off by default and refuses placeholders", async () => {
  assert.equal(knowledgeBaseConfigured({...env, KNOWLEDGE_BASE_ENABLED: "false"}), false);
  assert.equal(knowledgeBaseConfigured({...env, KNOWLEDGE_BASE_API_KEY: "replace_me"}), false);
  await assert.rejects(searchKnowledgeBase({query:"museum", env:{...env,KNOWLEDGE_BASE_ENABLED:"false"}}), /not configured/);
});
test("local development may use loopback, production requires reachable HTTPS", () => {
  assert.equal(knowledgeBaseEndpoint(env.KNOWLEDGE_BASE_URL, "development"), env.KNOWLEDGE_BASE_URL);
  assert.throws(()=>knowledgeBaseEndpoint(env.KNOWLEDGE_BASE_URL,"production"), /reachable HTTPS/);
  assert.equal(knowledgeBaseEndpoint("https://museum.example.org/api/search","production"),"https://museum.example.org/api/search");
  assert.throws(()=>knowledgeBaseEndpoint("https://example.org/other","production"), /api\/search/);
  assert.throws(()=>knowledgeBaseEndpoint("https://a:b@example.org/api/search","production"), /unmodified/);
  assert.throws(()=>knowledgeBaseEndpoint("https://example.org/api/search?key=abc","production"), /unmodified/);
});
test("no arbitrary museum or query payload reaches upstream", async () => {
  let calls=0;const fetchImpl=async()=>{calls++;return Response.json({})};
  for(const x of [
    {query:""},{query:"x".repeat(1501)},{query:"x", topK:100},
    {query:"x", museum:"m".repeat(121)}
  ]) await assert.rejects(searchKnowledgeBase({...x,env,fetchImpl}), /Invalid/);
  assert.equal(calls,0);
});
test("failed API calls redact the response body and API key", async () => {
  const err=await searchKnowledgeBase({query:"museum",env,
    fetchImpl:async()=>new Response("fake-test-secret private info", {status:401})
  }).then(()=>null,e=>e);
  assert.match(err.message,/HTTP 401/);
  assert.doesNotMatch(err.message,/fake-test-secret|private info/);
});
test("malformed, oversized and unexpected responses are not returned as text", async () => {
  await assert.rejects(searchKnowledgeBase({query:"museum",env,fetchImpl:async()=>new Response("not JSON",{status:200})}),/invalid JSON/);
  await assert.rejects(searchKnowledgeBase({query:"museum",env,fetchImpl:async()=>new Response("x".repeat(200001),{status:200})}),/too large/);
  await assert.rejects(searchKnowledgeBase({query:"museum",env,fetchImpl:async()=>Response.json("not an object")}),/invalid JSON/);
});
