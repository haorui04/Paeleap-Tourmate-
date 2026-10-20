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
