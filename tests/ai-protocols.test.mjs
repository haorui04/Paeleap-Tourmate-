import test from "node:test";
import assert from "node:assert/strict";
import {
  aiProtocol, modelEndpoint, anthropicPayload, extractAnthropicAssistantText, requestModelText
} from "../lib/ai/provider.js";
const baseUrl="https://api.miaoquai.com/v1", key="FAKE_ONLY_FOR_TESTS";
const messages=[
  {role:"system",content:"Tourism in China only."},
  {role:"user",content:"Tell me about West Lake."}
];

test("model protocol must be explicitly selected; defaults to existing Responses",()=>{
  assert.equal(aiProtocol({}),"responses");
  assert.equal(aiProtocol({AI_API_STYLE:"chat_completions"}),"chat_completions");
  assert.equal(aiProtocol({AI_API_STYLE:"anthropic"}),"anthropic");
  assert.throws(()=>aiProtocol({AI_API_STYLE:"auto"}),/Unsupported/);
});
test("Kimi, Claude and Responses inference paths are normalized once",()=>{
  assert.equal(modelEndpoint(baseUrl,"chat_completions"),baseUrl+"/chat/completions");
  assert.equal(modelEndpoint(baseUrl,"anthropic"),baseUrl+"/messages");
  assert.equal(modelEndpoint(baseUrl,"responses"),baseUrl+"/responses");
  assert.equal(modelEndpoint(baseUrl+"/responses","anthropic"),baseUrl+"/messages");
  assert.equal(modelEndpoint(baseUrl+"/chat/completions","responses"),baseUrl+"/responses");
  assert.throws(()=>modelEndpoint("http://api.miaoquai.com/v1","anthropic"),/HTTPS/);
  assert.throws(()=>modelEndpoint(baseUrl,"auto"),/Unsupported/);
});
test("Kimi OpenAI-compatible Chat Completions request and response",async()=>{
  let calls=0;
  const result=await requestModelText({baseUrl,key,model:"kimi-k2.5",protocol:"chat_completions",messages,
    fetchImpl:async(url,options)=>{
      calls++;
      assert.equal(url,baseUrl+"/chat/completions");
      assert.equal(options.headers.Authorization,"Bearer "+key);
      assert.deepEqual(JSON.parse(options.body),{model:"kimi-k2.5",messages,stream:false});
      return Response.json({choices:[{index:0,finish_reason:"stop",message:{role:"assistant",content:"West Lake is in Hangzhou."}}]});
    }});
  assert.equal(calls,1);
  assert.equal(result,"West Lake is in Hangzhou.");
});
test("Claude Anthropic Messages request and response have correct header and max_tokens",async()=>{
  let calls=0;
  const result=await requestModelText({baseUrl,key,model:"claude-sonnet-5-5",protocol:"anthropic",messages,
    fetchImpl:async(url,options)=>{
      calls++;
      assert.equal(url,baseUrl+"/messages");
      assert.equal(options.headers["x-api-key"],key);
      assert.equal(options.headers["anthropic-version"],"2023-06-01");
      assert.equal(options.headers.Authorization,undefined);
      assert.deepEqual(JSON.parse(options.body),{
        model:"claude-sonnet-5-5",max_tokens:1024,system:messages[0].content,
        messages:messages.slice(1),stream:false
      });
      return Response.json({id:"msg_test",type:"message",role:"assistant",
        stop_reason:"end_turn",content:[{type:"text",text:"西湖是杭州的著名景点。"}]});
    }});
  assert.equal(calls,1);
  assert.equal(result,"西湖是杭州的著名景点。");
});
test("Anthropic refuses partial, tool-use, refusal and reasoning-only messages",()=>{
  for(const x of [
    {type:"message",role:"assistant",stop_reason:"max_tokens",content:[{type:"text",text:"partial"}]},
    {type:"message",role:"assistant",stop_reason:"tool_use",content:[{type:"tool_use",id:"x"}]},
    {type:"message",role:"assistant",stop_reason:"end_turn",content:[{type:"thinking",thinking:"private"}]},
    {type:"message",role:"assistant",stop_reason:"end_turn",content:[{type:"refusal",text:"no"}]}
  ])assert.equal(extractAnthropicAssistantText(x),null);
});
test("wrong auth or model permissions fail without retries and without logging secrets",async(t)=>{
  const warnings=[];
  t.mock.method(console,"warn",(...args)=>warnings.push(args));
  for(const protocol of ["anthropic","chat_completions"]){
    let count=0;
    await assert.rejects(requestModelText({baseUrl,key,model:"restricted-model",protocol,messages,
      fetchImpl:async()=>{count++;return Response.json({error:{message:"Sensitive "+key}},{status:403})}
    }),/HTTP 403/);
    assert.equal(count,1);
  }
  assert.doesNotMatch(JSON.stringify(warnings),new RegExp(key));
});
test("model error or malformed provider response is never interpreted as an answer",async()=>{
  await assert.rejects(requestModelText({baseUrl,key,model:"kimi",protocol:"chat_completions",messages,
    fetchImpl:async()=>Response.json({error:{message:"not available"}})}),/invalid AI provider response/);
  await assert.rejects(requestModelText({baseUrl,key,model:"claude",protocol:"anthropic",messages,
    fetchImpl:async()=>new Response("<html>Error</html>",{status:200,headers:{"content-type":"text/html"}})}),/invalid AI provider response/);
});
