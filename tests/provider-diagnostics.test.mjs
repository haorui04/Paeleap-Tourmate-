import test from "node:test";
import assert from "node:assert/strict";
import { aiFailureCode } from "../lib/ai/diagnostics.js";
import { resolveAiApiKey } from "../lib/config.js";
import { generateGroundedReply } from "../lib/ai/generate.js";
import { CHINA_TOURISM_FAQS } from "../data/china-tourism-faq.js";

test("Codex Sub2API variable is preferred over legacy AI_API_KEY", () => {
  assert.equal(resolveAiApiKey({SUB2API_API_KEY:"dedicated-key",AI_API_KEY:"legacy-key"}),"dedicated-key");
  assert.equal(resolveAiApiKey({SUB2API_API_KEY:"replace_me",AI_API_KEY:"legacy-key"}),"legacy-key");
  assert.equal(resolveAiApiKey({AI_API_KEY:"replace_me"}),null);
});
test("diagnostics report safe allowlisted status without reflecting upstream detail", () => {
  for (const code of [400,401,402,403,404,422,429,500,503])
    assert.equal(aiFailureCode(new Error("AI provider returned HTTP "+code)),"UPSTREAM_HTTP_"+code);
  assert.equal(aiFailureCode(new Error("AI provider not configured")),"PROVIDER_CONFIG_MISSING");
  assert.equal(aiFailureCode(Object.assign(new Error(""),{name:"TimeoutError"})),"UPSTREAM_TIMEOUT");
  assert.equal(aiFailureCode(new Error("Empty or invalid AI provider response")),"INVALID_PROVIDER_RESPONSE");
  assert.equal(aiFailureCode(new Error("sk-topsecret user data")),"UPSTREAM_NETWORK_ERROR");
});
test("grounded mode uses SUB2API_API_KEY from Codex config when configured",async()=>{
  let calls=0;
  const result=await generateGroundedReply({
    message:"Tell me about West Lake", language:"en", faqs:CHINA_TOURISM_FAQS,
    env:{SUB2API_API_KEY:"test-dedicated",AI_API_KEY:"test-legacy",AI_BASE_URL:"https://api.miaoquai.com/v1",AI_MODEL:"deepseek-v4-pro"},
    fetchImpl: async (url,init)=>{
      calls++;
      assert.equal(url,"https://api.miaoquai.com/v1/responses");
      assert.equal(init.headers.Authorization,"Bearer test-dedicated");
      return Response.json({status:"completed",output:[{type:"message",role:"assistant",
        content:[{type:"output_text",text:"West Lake is in Hangzhou."}]}]});
    }
  });
  assert.equal(calls,1);
  assert.equal(result.mode,"grounded_generation");
});
