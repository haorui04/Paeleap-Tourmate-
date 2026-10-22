import test from "node:test";
import assert from "node:assert/strict";
import {chatEndpoint,requestFaqSelection,parseFaqSelection} from "../lib/ai/provider.js";
const args={url:"https://api.miaoquai.com/v1",key:"fake-key",model:"deepseek-v4-pro",messages:[{role:"system",content:"Return JSON."},{role:"user",content:"西湖在哪里？"}]};
const ok=(content='{"faqId":"CN061","confidence":0.99}',finish_reason="stop")=>Response.json({choices:[{finish_reason,message:{content}}]});
test("Miaoqu posts to the configured /v1 URL without appending a path",()=>{
 assert.equal(chatEndpoint("https://api.miaoquai.com/v1"),args.url);
 assert.equal(chatEndpoint(args.url),args.url);
 assert.equal(chatEndpoint('https://api.miaoquai.com/v1/'),args.url);
 assert.throws(()=>chatEndpoint("http://api.miaoquai.com/v1"),/HTTPS/);
});
test("DeepSeek JSON FAQ selection turns reasoning off",async()=>{
 let calls=0;
 const content=await requestFaqSelection({...args,fetchImpl:async(url,init)=>{
 calls++;assert.equal(url,args.url);assert.equal(init.headers.Authorization,"Bearer fake-key");assert.equal(init.cache,"no-store");
 const body=JSON.parse(init.body);assert.equal(body.model,"deepseek-v4-pro");assert.equal(body.max_tokens,384);
 assert.deepEqual(body.thinking,{type:"disabled"});assert.deepEqual(body.response_format,{type:"json_object"});
 return ok();
 }});
 assert.equal(calls,1);assert.deepEqual(parseFaqSelection(content,[{id:"CN061"}]),{faqId:"CN061",confidence:0.99});
});
for(const [errorText,removed,retained] of [
 ["Unrecognized parameter: thinking","thinking","response_format"],
 ["unsupported response_format","response_format","thinking"]
]) test("Miaoqu proxy compatibility: "+removed,async()=>{
 const bodies=[];
 await requestFaqSelection({...args,fetchImpl:async(_url,init)=>{
 bodies.push(JSON.parse(init.body));
 return bodies.length===1?Response.json({error:{message:errorText}},{status:400}):ok();
 }});
 assert.equal(bodies.length,2);assert.equal(removed in bodies[1],false);assert.ok(retained in bodies[1]);
});
test("proxy rejecting both optional parameters falls back to plain request once",async()=>{
 const bodies=[];
 await requestFaqSelection({...args,fetchImpl:async(_url,init)=>{
 bodies.push(JSON.parse(init.body));
 return bodies.length===1?Response.json({error:{message:"unsupported thinking and response_format"}},{status:422}):ok();
 }});
 assert.equal(bodies.length,2);assert.equal(bodies[1].max_tokens,2048);
 assert.equal("thinking" in bodies[1],false);assert.equal("response_format" in bodies[1],false);
});
test("auth and rate limits never retry",async()=>{
 for(const status of [401,403,429,500]){
 let n=0;await assert.rejects(requestFaqSelection({...args,fetchImpl:async()=>{n++;return Response.json({}, {status});}}),new RegExp(String(status)));assert.equal(n,1);
 }
});
test("truncated or malformed upstream responses fail closed",async()=>{
 await assert.rejects(requestFaqSelection({...args,fetchImpl:async()=>new Response("{oops",{status:200})}),/invalid AI/);
 await assert.rejects(requestFaqSelection({...args,fetchImpl:async()=>ok('{"faqId":"CN061"}',"length")}),/invalid AI/);
 assert.equal(parseFaqSelection("I invented an opening time",[{id:"CN061"}]),null);
});
test("unknown model is not retried",async()=>{
 let calls=0;await assert.rejects(requestFaqSelection({...args,fetchImpl:async()=>{calls++;return Response.json({error:"Model not found"},{status:400});}}),/400/);
 assert.equal(calls,1);
});
test("plain fallback does not retry unsupported parameter errors again",async()=>{
 let calls=0;await assert.rejects(requestFaqSelection({...args,fetchImpl:async()=>{calls++;return Response.json({error:{message:"unsupported thinking and response_format"}},{status:400});}}),/400/);
 assert.equal(calls,2);
});


test("provider accepts nested OpenAI-compatible choice payload", async () => {
  const answer = await requestFaqSelection({...args,fetchImpl:async()=>Response.json({data:{choices:[{message:{content:'{"faqId":"CN061","confidence":0.99}'}}]}})});
  assert.equal(parseFaqSelection(answer,[{id:"CN061"}]).faqId,"CN061");
});
test("provider accepts Responses API assistant output, but ignores reasoning text", async () => {
  const answer = await requestFaqSelection({...args,fetchImpl:async()=>Response.json({status:"completed",output:[
    {type:"reasoning",content:[{type:"reasoning_text",text:"private reasoning"}]},
    {type:"message",role:"assistant",content:[{type:"output_text",text:'{"faqId":"CN061","confidence":0.99}'}]}
  ]})});
  assert.equal(parseFaqSelection(answer,[{id:"CN061"}]).faqId,"CN061");
});
test("provider rejects HTML 200 and never logs its body", async (t) => {
  const logs=[];t.mock.method(console,"warn",(...args)=>logs.push(args));
  await assert.rejects(requestFaqSelection({...args,fetchImpl:async()=>new Response("<html>private payload</html>",{status:200,headers:{"content-type":"text/html"}})}),/invalid AI/);
  assert.equal(logs.length,1);
  assert.doesNotMatch(JSON.stringify(logs),/private payload/);
  assert.match(JSON.stringify(logs),/non_json/);
});
test("provider rejects success JSON without assistant text, logging only shape flags", async (t) => {
  const logs=[];t.mock.method(console,"warn",(...args)=>logs.push(args));
  await assert.rejects(requestFaqSelection({...args,fetchImpl:async()=>Response.json({error:{message:"private error"}})}),/invalid AI/);
  assert.equal(logs.length,1);
  assert.doesNotMatch(JSON.stringify(logs),/private error/);
  assert.equal(logs[0][1].hasErrorObject,true);
});


import { responsesEndpoint, responsesFaqPayload, requestResponsesFaqSelection } from "../lib/ai/provider.js";

const responsesArgs = {
  ...args,
  url: "https://api.miaoquai.com/v1/responses"
};
const responsesOk = (content = '{"faqId":"CN061","confidence":0.99}') =>
  Response.json({
    id: "resp_test", object: "response", status: "completed",
    output: [
      { type: "reasoning", content: [{ type: "reasoning_text", text: "internal-only reasoning" }] },
      { type: "message", role: "assistant", content: [{ type: "output_text", text: content }] }
    ]
  });

test("Sub2API base /v1 resolves to POST /v1/responses exactly once", () => {
  assert.equal(responsesEndpoint(args.url), responsesArgs.url);
  assert.equal(responsesEndpoint("https://api.miaoquai.com/v1/responses"), responsesArgs.url);
  assert.equal(responsesEndpoint("https://api.miaoquai.com/v1/chat/completions"), responsesArgs.url);
  assert.throws(() => responsesEndpoint("http://api.miaoquai.com/v1"), /HTTPS/);
});

test("Sub2API sends proper Responses wire format and disables storage", async () => {
  let calls = 0;
  const content = await requestResponsesFaqSelection({...responsesArgs,fetchImpl:async(url, init) => {
    calls++;
    assert.equal(url, responsesArgs.url);
    assert.equal(init.method, "POST");
    assert.equal(init.headers.Authorization, "Bearer fake-key");
    const data = JSON.parse(init.body);
    assert.equal(data.model, "deepseek-v4-pro");
    assert.deepEqual(data.input, args.messages);
    assert.equal(data.stream, false);
    assert.equal(data.store, false);
    assert.deepEqual(data.reasoning, { effort: "none" });
    assert.deepEqual(data.text, { format: { type: "json_object" } });
    for (const key of ["messages", "thinking", "response_format", "max_tokens"]) assert.equal(key in data, false);
    return responsesOk();
  }});
  assert.equal(calls, 1);
  assert.deepEqual(parseFaqSelection(content, [{id:"CN061"}]), {faqId:"CN061",confidence:0.99});
});

for (const [error, absent, retained] of [
  ["Unsupported parameter reasoning.effort", "reasoning", "text"],
  ["Unrecognized text.format", "text", "reasoning"],
]) test("Sub2API optional field compatibility: "+absent, async () => {
  const bodies = [];
  await requestResponsesFaqSelection({...responsesArgs,fetchImpl:async(_url,init)=>{
    bodies.push(JSON.parse(init.body));
    return bodies.length === 1
      ? Response.json({error:{message:error}},{status:400})
      : responsesOk();
  }});
  assert.equal(bodies.length,2);
  assert.equal(absent in bodies[1],false);
  assert.equal(retained in bodies[1],true);
  assert.equal(bodies[1].store,false);
});

test("Sub2API refuses failed or incomplete Responses and ignores reasoning-only outputs", async () => {
  for (const data of [
    {status:"incomplete",output:[{type:"message",role:"assistant",content:[{type:"output_text",text:'{"faqId":"CN061","confidence":0.99}'}]}]},
    {status:"failed",output:[]},
    {status:"completed",output:[{type:"reasoning",content:[{type:"reasoning_text",text:'{"faqId":"CN061","confidence":0.99}'}]}]}
  ]) {
    await assert.rejects(requestResponsesFaqSelection({...responsesArgs,fetchImpl:async()=>Response.json(data)}),/invalid AI/);
  }
});

test("Sub2API does not retry invalid credentials, rate limits, unknown models, or server errors", async()=>{
  for (const status of [400,401,403,404,429,500]) {
    let calls=0;
    await assert.rejects(requestResponsesFaqSelection({...responsesArgs,fetchImpl:async()=>{calls++;return Response.json({error:{message:"Model not found"}},{status});}}),new RegExp(String(status)));
    assert.equal(calls,1);
  }
});

test("Sub2API plain fallback preserves privacy setting", async () => {
  const bodies=[];
  await requestResponsesFaqSelection({...responsesArgs,fetchImpl:async(_url,init)=>{
    bodies.push(JSON.parse(init.body));
    return bodies.length===1
      ? Response.json({error:{message:"Unsupported reasoning.effort and text.format"}},{status:422})
      : responsesOk();
  }});
  assert.equal(bodies.length,2);
  assert.equal(bodies[1].store,false);
  assert.equal("reasoning" in bodies[1],false);
  assert.equal("text" in bodies[1],false);
});

test("Sub2API output cannot bypass known FAQ verification", async () => {
  const content=await requestResponsesFaqSelection({...responsesArgs,fetchImpl:async()=>responsesOk('I invented an opening time')});
  assert.equal(parseFaqSelection(content,[{id:"CN061"}]),null);
});

test("Miaoqu Responses HTTP failures log status and only redacted diagnostic flags", async (t) => {
  const warnings = [];
  t.mock.method(console, "warn", (...args) => warnings.push(args));
  const privateMessage = "private-visitor-question-never-log";
  const secret = "test-fake-secret-never-log";
  let calls = 0;
  const failure = await requestResponsesFaqSelection({
    ...responsesArgs, key: secret,
    fetchImpl: async () => {
      calls++;
      return Response.json({
        error: {
          code: "invalid_request_error",
          message: "Invalid model " + privateMessage + " and " + secret
        }
      }, { status: 400 });
    }
  }).then(() => null, (e) => e);
  assert.match(failure.message, /HTTP 400/);
  assert.equal(calls, 1);
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0][0], "Miaoqu Responses upstream rejection");
  assert.equal(warnings[0][1].httpStatus, 400);
  assert.equal(warnings[0][1].errorCode, "invalid_request_error");
  assert.equal(warnings[0][1].mentionsModel, true);
  assert.doesNotMatch(JSON.stringify(warnings), new RegExp(privateMessage + "|" + secret));
});

test("Miaoqu Responses status diagnostics also classify 401 without exposing provider body", async (t) => {
  const warnings = [];
  t.mock.method(console, "warn", (...args) => warnings.push(args));
  await assert.rejects(requestResponsesFaqSelection({
    ...responsesArgs,
    fetchImpl: async () => new Response("<html>hidden personal data</html>", {
      status: 401, headers: { "Content-Type": "text/html" }
    })
  }), /HTTP 401/);
  assert.equal(warnings[0][1].httpStatus, 401);
  assert.equal(warnings[0][1].looksLikeHtml, true);
  assert.doesNotMatch(JSON.stringify(warnings), /hidden personal data/);
});

test("transient Miaoqu 503 receives exactly one bounded retry and then returns generation", async (t) => {
  const warnings = [];
  t.mock.method(console, "warn", (...args) => warnings.push(args));
  let count = 0;
  const result = await requestResponsesFaqSelection({
    ...responsesArgs, minimalFirst: true,
    fetchImpl: async () => {
      count++;
      return count === 1
        ? Response.json({error: {code:"unavailable",message:"Service unavailable"}}, {status:503})
        : responsesOk();
    }
  });
  assert.equal(count, 2);
  assert.equal(parseFaqSelection(result,[{id:"CN061"}]).faqId, "CN061");
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0][1].httpStatus, 503);
});

test("persistent 503 gives up after second request and keeps diagnostics private", async (t) => {
  const warnings = [];
  t.mock.method(console, "warn", (...args) => warnings.push(args));
  let count = 0;
  await assert.rejects(requestResponsesFaqSelection({
    ...responsesArgs, minimalFirst: true,
    fetchImpl: async () => {
      count++;
      return Response.json({error:{message:"private-user-content-from-provider"}}, {status:503});
    }
  }), /HTTP 503/);
  assert.equal(count,2);
  assert.equal(warnings.length,2);
  assert.doesNotMatch(JSON.stringify(warnings), /private-user-content/);
});

test("503 retry never changes model or minimal Responses payload", async () => {
  const payloads = [];
  await requestResponsesFaqSelection({
    ...responsesArgs, minimalFirst:true,
    fetchImpl: async (_url,init) => {
      payloads.push(JSON.parse(init.body));
      return payloads.length === 1
        ? Response.json({error:{message:"upstream busy"}},{status:503})
        : responsesOk();
    }
  });
  assert.deepEqual(payloads,[payloads[0],payloads[0]]);
  assert.deepEqual(Object.keys(payloads[0]).sort(),["input","model","stream"]);
});
