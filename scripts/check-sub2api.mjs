#!/usr/bin/env node
// Minimal live provider probe. Run only with a rotated key stored in an
// environment variable. Prints no secret values, prompts or model output.
import { aiProtocol, requestModelText } from "../lib/ai/provider.js";
import { hasConfiguredValue, resolveAiApiKey } from "../lib/config.js";
import { aiFailureCode } from "../lib/ai/diagnostics.js";

const key = resolveAiApiKey();
const baseUrl = process.env.AI_BASE_URL || "https://api.miaoquai.com/v1";
const model = process.env.AI_MODEL;
const protocol = aiProtocol();
if (!hasConfiguredValue(key) || !hasConfiguredValue(model)) {
  console.error(JSON.stringify({result:"NOT_RUN",code:"PROVIDER_CONFIG_MISSING",
    instructions:"Set a rotated SUB2API_API_KEY or AI_API_KEY, and the exact AI_MODEL supported by its group."}));
  process.exitCode = 2;
} else {
  try {
    const reply = await requestModelText({
      baseUrl, key, model, protocol,
      messages:[{role:"user",content:"Reply with only OK."}]
    });
    console.log(JSON.stringify({
      result:"SUCCESS",model,protocol, assistantTextReceived:Boolean(reply && reply.trim()),
      // A successful response does not establish correct RAG output/safety.
      note:"Provider reachable; this does not test Supabase or the deployed chatbot."
    }));
  } catch(error) {
    console.error(JSON.stringify({result:"FAILED",model,protocol,code:aiFailureCode(error)}));
    process.exitCode = 1;
  }
}
