import test from "node:test";import assert from "node:assert/strict";
import {DESHOU_PERSONA as persona} from "../data/personas/deshou-palace.js";
import {nextDraft,draftKey,parseBrowserDraft,filterKnowledge,newKnowledgeRecord} from "../lib/client/admin-editor.js";
import {GET} from "../app/api/admin/personas/history/route.js";
test("restore creates a new version without mutating published content",()=>{const draft=nextDraft(persona,5);draft.name.en="Edited";assert.equal(draft.version,6);assert.notEqual(persona.name.en,"Edited");});
test("browser drafts are account and persona scoped",()=>{assert.notEqual(draftKey("a","museum"),draftKey("b","museum"));assert.notEqual(draftKey("a","museum"),draftKey("a","other"));});
test("draft round trip supports unfinished edits; malformed drafts reject before rendering",()=>{const p=nextDraft(persona,1);p.name.en="";assert.equal(parseBrowserDraft(JSON.stringify({payload:p,latest:1}),p.id).payload.name.en,"");for(const changed of [{...p,knowledge:[{}]},{...p,role:null},{...p,scope:[null]}])assert.throws(()=>parseBrowserDraft(JSON.stringify({payload:changed,latest:1}),p.id));assert.throws(()=>parseBrowserDraft(JSON.stringify({payload:p,latest:1}),"other"));});
test("search works for bilingual answers and retains original indices",()=>{const rows=filterKnowledge(persona.knowledge,"七管");assert.ok(rows.length);assert.equal(persona.knowledge[rows[0].index].id,rows[0].record.id);assert.equal(newKnowledgeRecord().sources.length,0);});
const actor="550e8400-e29b-41d4-a716-446655440000";
function fixture(t,{user=actor}={}){
 const settings={PERSONA_ADMIN_USER_IDS:actor,SUPABASE_URL:"https://fixture.invalid",SUPABASE_SERVICE_ROLE_KEY:"fixture-service",SUPABASE_PUBLISHABLE_KEY:"fixture-public"};
 const before={};for(const[k,v]of Object.entries(settings)){before[k]=process.env[k];process.env[k]=v;}
 t.after(()=>{for(const[k,v]of Object.entries(before))v===undefined?delete process.env[k]:process.env[k]=v;});
 const paths=[];t.mock.method(globalThis,"fetch",async address=>{const url=new URL(address);paths.push(url.pathname+url.search);
 if(url.pathname==="/auth/v1/user")return Response.json({id:user});
 if(url.searchParams.get("select")==="version,published_at")return Response.json([{version:1,published_at:"2026-11-03T00:00:00Z"}]);
 return Response.json([{payload:persona}]);});return paths;
}
function request(query="",token=true,origin){return new Request("https://app.example/api/admin/personas/history?personaId=little-de-rabbit"+query,{headers:{...(token?{Authorization:"Bearer fixture-token"}:{}),...(origin?{Origin:origin}:{})}});}
test("administrator reads version metadata and selected package",async t=>{const paths=fixture(t);const r=await GET(request("&version=1"));assert.equal(r.status,200);const body=await r.json();assert.equal(body.persona.id,persona.id);assert.equal(body.versions[0].version,1);assert.ok(paths.some(path=>path.includes("version=eq.1")));assert.equal(r.headers.get("cache-control"),"no-store");});
test("non-admin cannot read knowledge or history",async t=>{const paths=fixture(t,{user:"11111111-1111-4111-8111-111111111111"});assert.equal((await GET(request())).status,403);assert.equal(paths.length,1);});
test("missing auth cannot reach storage",async t=>{const paths=fixture(t);assert.equal((await GET(request("",false))).status,401);assert.equal(paths.length,0);});
test("cross-origin requests fail before authentication",async t=>{const paths=fixture(t);assert.equal((await GET(request("",true,"https://evil.example"))).status,403);assert.equal(paths.length,0);});
for(const version of ["0","-1","1junk","2147483648"])test("invalid history version "+version+" cannot query packages",async t=>{const paths=fixture(t);assert.equal((await GET(request("&version="+version))).status,400);assert.equal(paths.length,1);});
