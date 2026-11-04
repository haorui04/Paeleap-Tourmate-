import test from 'node:test';import assert from 'node:assert/strict';
import {eventMetadata,requestOutcome,dateWindow,summarizeEvents,readAnalytics,captureAnalytics,analyticsBucket,ANALYTICS_BUCKET} from '../lib/admin/analytics.js';
import {GET} from '../app/api/admin/analytics/route.js';
import {DESHOU_PERSONA as persona} from '../data/personas/deshou-palace.js';
import {museumArtifactRecords,recordName} from '../lib/attachments/museum.js';
const artifact=museumArtifactRecords(persona)[0],actor='550e8400-e29b-41d4-a716-446655440000',id='11111111-1111-4111-8111-111111111111';
const at='2026-11-03T16:01:00.000Z',startedAt='2026-11-03T16:00:00.000Z',asOf='2026-11-04T10:00:00.000Z';
const base={persona,message:'Tell me about '+recordName(artifact,'en'),status:'allowed',mode:'museum_generated',language:'en',inputType:'text'};
test('explicit bilingual names map to one stable catalogue ID',()=>{for(const lang of ['en','zh'])assert.equal(eventMetadata({...base,message:recordName(artifact,lang)}).artifact.id,artifact.id);});
test('retrieved citations alone do not become artifact enquiries',()=>{assert.equal(eventMetadata({...base,message:'Tell me the museum history',recordIds:[artifact.id]}).artifact,null);});
test('attachment filenames and partial English words do not establish artifact interest',()=>{
 assert.equal(eventMetadata({...base,message:'What is its material?',history:[{role:'user',content:'Identify this\n\n[Attached: '+recordName(artifact,'en')+'.jpg]'}]}).artifact,null);
 const sample={...persona,knowledge:[{...artifact,id:'BOWL',question_en:'What is the bowl?',question_zh:'瓷碗是什么？'}]};
 assert.equal(eventMetadata({...base,persona:sample,message:'Tell me about bowling'}).artifact,null);
 assert.equal(eventMetadata({...base,persona:sample,message:'Tell me about the bowl'}).artifact.id,'BOWL');
});
test('multiple artifact names remain unclassified instead of inventing one primary object',()=>{const rows=museumArtifactRecords(persona);assert.equal(eventMetadata({...base,message:recordName(rows[0],'en')+' and '+recordName(rows[1],'en')}).artifact,null);});
test('a pronoun follow-up inherits only an explicit latest user referent',()=>{assert.equal(eventMetadata({...base,message:'What is its material?',history:[{role:'user',content:recordName(artifact,'en')}]}).artifact.id,artifact.id);assert.equal(eventMetadata({...base,message:'What is its material?',history:[{role:'assistant',content:recordName(artifact,'en')}]}).artifact,null);});
test('only validated image match IDs produce catalogue-match outcomes',()=>{assert.equal(eventMetadata({...base,inputType:'image',mode:'museum_identity_match',recordIds:[artifact.id],message:'Identify this'}).imageOutcome,'matched');assert.equal(eventMetadata({...base,inputType:'image',mode:'museum_identity_uncertain',message:'Identify this'}).imageOutcome,'uncertain');assert.equal(eventMetadata({...base,inputType:'image',status:'blocked'}).imageOutcome,'rejected');assert.equal(eventMetadata({...base,inputType:'image',mode:'museum_identity_not_found'}).imageOutcome,'not_found');assert.equal(eventMetadata({...base,inputType:'image',mode:'museum_attachment_unavailable'}).imageOutcome,'unavailable');});
test('uncertainty, service outage and blocked requests are not counted as successful answers',()=>{assert.equal(requestOutcome({status:'allowed',mode:'museum_clarification'}),'needs_detail');assert.equal(requestOutcome({status:'allowed',mode:'museum_attachment_unavailable'}),'unavailable');assert.equal(requestOutcome({status:'blocked'}),'safety');assert.equal(requestOutcome({status:'redirected',inScope:true}),'needs_detail');assert.equal(requestOutcome({status:'redirected'}),'redirected');});
test('event metadata contains no question, answer, user token or image bytes',()=>{const data=eventMetadata({...base,message:base.message+' secret_token',token:'private',bytes:Buffer.from('private')});assert.ok(!JSON.stringify(data).includes('secret_token'));assert.equal(data.message,undefined);assert.equal(data.token,undefined);assert.equal(data.bytes,undefined);});
test('date range uses Shanghai boundaries and rejects invalid or excessive ranges',()=>{const range=dateWindow('2026-11-04','2026-11-04',new Date(asOf));assert.equal(range.start,'2026-11-03T16:00:00.000Z');assert.equal(range.end,asOf);for(const [a,b]of [['2026-02-30','2026-03-01'],['2026-99-01','2026-99-02'],['2026-11-05','2026-11-04'],['2026-01-01','2026-02-01'],['bad','bad']])assert.throws(()=>dateWindow(a,b),{name:'PersonaError'});});
const event={...eventMetadata(base),id,at,traffic:'visitor'};
test('aggregation deduplicates request IDs and removes deleted history from all charts',()=>{const result=summarizeEvents([event,event,{...event,id:'deleted'}],new Map([[id,'question']]),{from:'2026-11-03',to:'2026-11-04',startedAt,asOf,expected:1});assert.equal(result.total,1);assert.equal(result.artifacts[0].count,1);assert.equal(result.days[0].count,null);assert.equal(result.days[1].count,1);assert.equal(result.coverageComplete,true);});
test('coverage gaps remain explicit and unresolved questions are redacted',()=>{const result=summarizeEvents([{...event,outcome:'needs_detail'}],new Map([[id,'My email is visitor@example.com. What is this?']]),{from:'2026-11-04',to:'2026-11-04',startedAt,asOf,expected:2});assert.equal(result.coverageComplete,false);assert.equal(result.unresolvedCount,1);assert.ok(!result.unresolved[0].question.includes('visitor@example.com'));assert.ok(result.unresolved[0].question.includes('REDACTED'));});
test('image outcomes sum independently of text requests',()=>{const events=['matched','not_found','uncertain','unavailable','rejected'].map((imageOutcome,i)=>({...event,id:'image'+i,inputType:'image',imageOutcome}));const result=summarizeEvents(events,new Map(events.map(e=>[e.id,'Identify this'])),{from:'2026-11-04',to:'2026-11-04',startedAt,asOf,expected:5});assert.equal(Object.values(result.images).reduce((a,b)=>a+b),5);});
function fixture(t,{user=actor,expected=1,missing=false,publicBucket=false}={}){
 const settings={SUPABASE_URL:'https://fixture.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'fixture-service',SUPABASE_PUBLISHABLE_KEY:'fixture-public',PERSONA_ADMIN_USER_IDS:actor,NODE_ENV:'production',ANALYTICS_ENABLED:'true'};const before={};for(const[k,v]of Object.entries(settings)){before[k]=process.env[k];process.env[k]=v;}t.after(()=>{for(const[k,v]of Object.entries(before))v===undefined?delete process.env[k]:process.env[k]=v;});
 const calls=[];t.mock.method(globalThis,'fetch',async(address,init={})=>{const url=new URL(address);calls.push({url,init});
  if(url.pathname==='/auth/v1/user')return Response.json({id:user});
  if(url.pathname==='/rest/v1/persona_packages')return Response.json([{payload:persona}]);
  if(url.pathname==='/rest/v1/messages'){
   if(init.method==='HEAD')return new Response(null,{headers:{'content-range':'*/'+expected}});
   if(url.searchParams.get('select')==='id,created_at')return Response.json([{id,created_at:at}]);
   return Response.json(missing?[]:[{id,content:'How does this artifact work?'}]);
  }
  if(url.pathname==='/storage/v1/bucket/'+ANALYTICS_BUCKET)return Response.json({public:publicBucket});
  if(url.pathname.includes('/object/list/'))return Response.json(JSON.parse(init.body).prefix==='events/2026-11-03'?[{id:'object-id',name:id+'.json'}]:[]);
  if(init.method==='POST')return Response.json({Key:'recorded'});
  if(url.pathname.endsWith('configuration.json'))return Response.json({schema:1,startedAt});
  if(url.pathname.endsWith(id+'.json'))return Response.json(event);
  throw Error('Unexpected request '+url.pathname);
 });return calls;
}
test('private bucket rejects public visibility',async t=>{fixture(t,{publicBucket:true});await assert.rejects(()=>analyticsBucket(),{status:503});});
test('read validates events against surviving museum history and exact baseline count',async t=>{const calls=fixture(t);const result=await readAnalytics(persona.id,'2026-11-04','2026-11-04');assert.equal(result.total,1);assert.equal(result.expected,1);assert.equal(result.coverageComplete,true);assert.ok(calls.some(c=>c.init.method==='HEAD'&&c.url.searchParams.get('conversations.user_id')?.includes(actor)));assert.ok(calls.every(c=>c.url.origin==='https://fixture.supabase.co'));});
test('failed event recording is visible as incomplete coverage',async t=>{fixture(t,{missing:true});const result=await readAnalytics(persona.id,'2026-11-04','2026-11-04');assert.equal(result.total,0);assert.equal(result.coverageComplete,false);});
test('administrator traffic is excluded from default visitor events',async t=>{fixture(t);assert.equal((await readAnalytics(persona.id,'2026-11-04','2026-11-04','test')).total,0);});
test('collection links a unique persisted message, labels test traffic and never copies prompt text',async t=>{const calls=fixture(t);await captureAnalytics({...base,user:{id:actor},conversationId:id,message:'test input never copied',question:base.message,startedAt:Date.parse(at)});const upload=calls.find(c=>c.init.method==='POST'&&c.url.pathname.endsWith(id+'.json'));assert.ok(upload);const payload=JSON.parse(upload.init.body);assert.equal(payload.id,id);assert.equal(payload.traffic,'test');assert.equal(payload.artifact.id,artifact.id);assert.ok(!upload.init.body.includes('test input never copied'));});
test('tracking disabled skips all outbound analytics calls',async t=>{const calls=fixture(t);process.env.ANALYTICS_ENABLED='false';await captureAnalytics({persona});assert.equal(calls.length,0);});
function request(query='',token=true,origin){return new Request('https://app.example/api/admin/analytics?personaId=little-de-rabbit&from=2026-11-04&to=2026-11-04'+query,{headers:{...(token?{Authorization:'Bearer fixture-token'}:{}),...(origin?{Origin:origin}:{})}});}
test('dashboard is protected by server-verified administrator identity',async t=>{const calls=fixture(t,{user:id});assert.equal((await GET(request())).status,403);assert.equal(calls.length,1);});
test('anonymous and cross-origin requests cannot query analytics',async t=>{const calls=fixture(t);assert.equal((await GET(request('',false))).status,401);assert.equal((await GET(request('',true,'https://evil.example'))).status,403);assert.equal(calls.length,0);});
test('duplicate and unsupported filters reject before reading private events',async t=>{const calls=fixture(t);for(const q of ['&personaId=other','&table=users'])assert.equal((await GET(request(q))).status,400);assert.equal(calls.length,2);});
test('authorized dashboard response has no-store caching and exact totals',async t=>{fixture(t);const r=await GET(request());assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'no-store');assert.equal((await r.json()).total,1);});
