#!/usr/bin/env node
// Minimal live provider probe. Run only with a rotated key stored in an
// environment variable. Prints no secret values, prompts or model output.
import { responsesEndpoint, requestResponsesFaqSelection } from "../lib/ai/provider.js";
import { hasConfiguredValue, resolveAiApiKey } from "../lib/config.js";
import { aiFailureCode } from "../lib/ai/diagnostics.js";

const key = resolveAiApiKey();
const baseUrl = process.env.AI_BASE_URL || "https://api.miaoquai.com/v1";
const model = process.env.AI_MODEL || "deepseek-v4-pro";
if (!hasConfiguredValue(key)) {
  console.error(JSON.stringify({result:"NOT_RUN",code:"PROVIDER_CONFIG_MISSING",
    instructions:"Set SUB2API_API_KEY (preferred) or AI_API_KEY in the environment, then run npm run ai:check."}));
  process.exitCode = 2;
} else {
  try {
    const reply = await requestResponsesFaqSelection({
      url: responsesEndpoint(baseUrl), key, model,
      messages:[{role:"user",content:"Reply with only OK."}],
      minimalFirst:true
    });
    console.log(JSON.stringify({
      result:"SUCCESS",model, assistantTextReceived:Boolean(reply && reply.trim()),
      // A successful response does not establish correct RAG output/safety.
      note:"Provider reachable; this does not test Supabase or the deployed chatbot."
    }));
  } catch(error) {
    console.error(JSON.stringify({result:"FAILED",model,code:aiFailureCode(error)}));
    process.exitCode = 1;
  }
}
