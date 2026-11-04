// Server-only, immutable event files. No prompts, replies, images or user tokens
// are copied into analytics. Message IDs link to the existing deletable history.
import {knowledgeStorage} from './knowledge-source.js';
import {PersonaError} from '../personas/validation.js';
import {museumArtifactRecords,recordName} from '../attachments/museum.js';
import {redactSensitiveText} from '../ai/input-normalization.js';
export const ANALYTICS_BUCKET='tourmate-analytics';
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const LIMIT=5000;
const adminIds=()=>(process.env.PERSONA_ADMIN_USER_IDS||'').split(',').map(id=>id.trim().toLowerCase()).filter(id=>UUID.test(id));
export const trackingEnabled=()=>process.env.ANALYTICS_ENABLED==='true'&&process.env.NODE_ENV==='production';
export async function analyticsBucket(storage=knowledgeStorage(),initialize=false){
 let {data,error}=await storage.getBucket(ANALYTICS_BUCKET);
 if(error&&initialize&&(String(error.status??error.statusCode)==='404'||/^bucket not found$/i.test(error.message||''))){
  const made=await storage.createBucket(ANALYTICS_BUCKET,{public:false,fileSizeLimit:32768,allowedMimeTypes:['application/json']});
  if(made.error&&String(made.error.status??made.error.statusCode)!=='409')throw new PersonaError('Analytics storage initialization failed',503);
  ({data,error}=await storage.getBucket(ANALYTICS_BUCKET));
 }
 if(error||!data||data.public!==false)throw new PersonaError('Private analytics storage is unavailable',503);
 return storage.from(ANALYTICS_BUCKET);
}
export async function analyticsConfig(files,initialize=false){
 let response=await files.download('configuration.json');
 if(response.error&&initialize){
  const config={schema:1,startedAt:new Date().toISOString()};
  const written=await files.upload('configuration.json',JSON.stringify(config),{contentType:'application/json',upsert:false});
  if(written.error&&String(written.error.status??written.error.statusCode)!=='409')throw new PersonaError('Analytics initialization failed',503);
  response=await files.download('configuration.json');
 }
 if(response.error||!response.data)throw new PersonaError('Analytics collection has not been initialized',503);
 const config=JSON.parse(await response.data.text());
 if(config.schema!==1||!Number.isFinite(Date.parse(config.startedAt)))throw new PersonaError('Invalid analytics configuration',503);
 return config;
}
async function database(path,{head=false}={}){
 const base=new URL(process.env.SUPABASE_URL),key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(base.protocol!=='https:'||!key)throw new PersonaError('Analytics database is unavailable',503);
 const r=await fetch(base.origin+'/rest/v1/'+path,{method:head?'HEAD':'GET',headers:{apikey:key,Authorization:'Bearer '+key,Prefer:'count=exact'},cache:'no-store',redirect:'error',signal:AbortSignal.timeout(10000)});
 if(!r.ok)throw new PersonaError('Analytics history verification failed',503);
 if(head){const count=r.headers.get('content-range')?.split('/')[1];if(!/^\d+$/.test(count||''))throw new PersonaError('Analytics count unavailable',503);return Number(count);}
 const text=await r.text();if(Buffer.byteLength(text)>2097152)throw new PersonaError('Analytics history exceeds read limit',503);
 const rows=JSON.parse(text);if(!Array.isArray(rows))throw new PersonaError('Invalid analytics history',503);return rows;
}
export function requestOutcome({status,mode,degraded=false,inScope=false}){
 if(['blocked','emergency','sanitized'].includes(status))return 'safety';
 if(status==='redirected')return inScope?'needs_detail':'redirected';
 if(/unavailable|not_found|uncertain|clarification|visual_description/.test(mode||''))return /unavailable/.test(mode)?'unavailable':'needs_detail';
 return degraded?'fallback':'answered';
}
export function eventMetadata({persona,message,history=[],recordIds=[],status,mode,inputType,language,degraded=false,inScope=false}){
 const rows=museumArtifactRecords(persona),safe=status==='allowed';
 const normalized=s=>String(s).normalize('NFKC').toLowerCase();
 const matches=text=>rows.filter(row=>['en','zh'].some(lang=>{
  const name=normalized(recordName(row,lang));
  const content=normalized(String(text).replace(/\n\n\[(?:Attached: |附件：)[\s\S]*$/u,''));
  if(name.length<(lang==='zh'?2:3))return false;
  if(lang==='zh')return content.includes(name);
  const parts=content.split(name);
  return parts.some((part,i)=>i<parts.length-1&&!/[a-z0-9]/.test(part.slice(-1))&&!/[a-z0-9]/.test(parts[i+1].slice(0,1)));
 }));
 let named=safe?matches(message):[];
 // Pronoun follow-ups inherit only one explicit artifact from the latest user turn.
 if(!named.length&&safe&&/\b(?:it|its|this artifact|that artifact)\b|它|这件|這件/i.test(message)){
  const previous=history.slice().reverse().find(turn=>turn.role==='user');if(previous)named=matches(previous.content);
 }
 const identityMatch=safe&&['museum_identity_match','museum_artifact_match','museum_artifact_web_match'].includes(mode);
 const selected=identityMatch&&recordIds.length===1?rows.find(row=>row.id===recordIds[0]):named.length===1?named[0]:null;
 const imageOutcome=inputType!=='image'?null:!safe?'rejected':identityMatch&&selected?'matched':mode==='museum_identity_not_found'?'not_found':/unavailable/.test(mode||'')?'unavailable':'uncertain';
 return {schema:1,personaId:persona.id,personaVersion:persona.version,language,inputType,outcome:requestOutcome({status,mode,degraded,inScope}),imageOutcome,
  artifact:selected?{id:selected.id,en:recordName(selected,'en'),zh:recordName(selected,'zh')}:null};
}
export async function captureAnalytics({user,conversationId,message,startedAt,...metadata}){
 if(!trackingEnabled()||metadata.persona.id==='tourmate')return;
 try{
  const rows=await database('messages?select=id,created_at&conversation_id=eq.'+encodeURIComponent(conversationId)+'&role=eq.user&content=eq.'+encodeURIComponent(message)+'&created_at=gte.'+encodeURIComponent(new Date(startedAt-2000).toISOString())+'&order=created_at.desc&limit=1');
  const row=rows[0];if(!row||!UUID.test(row.id)||!Number.isFinite(Date.parse(row.created_at)))throw Error('Missing history event');
  const files=await analyticsBucket();
  const event={...eventMetadata({...metadata,message:metadata.question??message}),traffic:adminIds().includes(user.id.toLowerCase())?'test':'visitor',id:row.id,at:new Date(row.created_at).toISOString(),durationMs:Math.max(0,Date.now()-startedAt)};
  const written=await files.upload('events/'+event.at.slice(0,10)+'/'+row.id+'.json',JSON.stringify(event),{contentType:'application/json',upsert:false});
  if(written.error&&String(written.error.status??written.error.statusCode)!=='409')throw Error('Tracking write failed');
 }catch{console.warn('Analytics event unavailable');} // The dashboard verifies coverage against history.
}
export function dateWindow(from,to,now=new Date()){
 const valid=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s+'T00:00:00Z'))&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
 if(!valid(from)||!valid(to))throw new PersonaError('Choose valid start and end dates');
 const start=new Date(from+'T00:00:00+08:00'),end=new Date(to+'T00:00:00+08:00');end.setUTCDate(end.getUTCDate()+1);
 if(end<=start||end-start>31*86400000)throw new PersonaError('Select a range of 1–31 days');
 return {from,to,start:start.toISOString(),end:new Date(Math.min(end.getTime(),now.getTime())).toISOString()};
}
async function parallel(items,fn,width=12){const output=[];let next=0;await Promise.all(Array.from({length:Math.min(width,items.length)},async()=>{for(;;){const i=next++;if(i>=items.length)break;output[i]=await fn(items[i]);}}));return output;}
export function summarizeEvents(events,questions,{from,to,startedAt,expected,asOf}){
 const firstDay=new Date(Date.parse(startedAt)+8*3600000).toISOString().slice(0,10),lastDay=new Date(Date.parse(asOf)+8*3600000).toISOString().slice(0,10);
 const days=[];for(let date=new Date(from+'T00:00:00Z');date<=new Date(to+'T00:00:00Z');date.setUTCDate(date.getUTCDate()+1)){const key=date.toISOString().slice(0,10);days.push({date:key,count:key<firstDay||key>lastDay?null:0});}
 const artifacts=new Map(),images={matched:0,not_found:0,uncertain:0,unavailable:0,rejected:0};let unclassified=0;
 const unresolved=[];const seen=new Set();
 for(const event of events){
  if(seen.has(event.id)||!questions.has(event.id))continue;seen.add(event.id);
  const day=new Date(Date.parse(event.at)+8*3600000).toISOString().slice(0,10);const bin=days.find(row=>row.date===day);if(bin&&bin.count!==null)bin.count++;
  if(event.artifact){const key=event.artifact.id;const row=artifacts.get(key)||{...event.artifact,count:0};row.count++;artifacts.set(key,row);}else unclassified++;
  if(event.imageOutcome){if(!(event.imageOutcome in images))throw new PersonaError('Unknown image outcome',503);images[event.imageOutcome]++;}
  if(['needs_detail','unavailable'].includes(event.outcome))unresolved.push({id:event.id,at:event.at,question:redactSensitiveText(questions.get(event.id),{maxCharacters:1500}).slice(0,240),outcome:event.outcome,inputType:event.inputType});
 }
 const ranked=[...artifacts.values()].sort((a,b)=>b.count-a.count||a.id.localeCompare(b.id));const total=seen.size;
 return {from,to,startedAt,asOf,total,expected,coverageComplete:total===expected,unclassified,artifacts:ranked,days,images,
  unresolvedCount:unresolved.length,unresolved:unresolved.sort((a,b)=>b.at.localeCompare(a.at)).slice(0,100)};
}
export async function readAnalytics(personaId,from,to,traffic='visitor'){
 if(!['visitor','test'].includes(traffic))throw new PersonaError('Choose visitor or administrator test traffic');
 const window=dateWindow(from,to),files=await analyticsBucket(),config=await analyticsConfig(files);
 const start=new Date(Math.max(Date.parse(window.start),Date.parse(config.startedAt))).toISOString(),end=window.end;
 if(start>=end)return summarizeEvents([],new Map(),{from,to,startedAt:config.startedAt,expected:0,asOf:end});
 const paths=[];
 for(let day=new Date(start.slice(0,10)+'T00:00:00Z');day<=new Date(end);day.setUTCDate(day.getUTCDate()+1)){
  const folder='events/'+day.toISOString().slice(0,10);
  for(let offset=0;;offset+=1000){const {data,error}=await files.list(folder,{limit:1000,offset,sortBy:{column:'name',order:'asc'}});
   if(error||!Array.isArray(data))throw new PersonaError('Analytics event listing failed',503);
   for(const row of data)if(row.id&&/^[a-f0-9-]{36}[.]json$/i.test(row.name))paths.push(folder+'/'+row.name);
   if(paths.length>LIMIT)throw new PersonaError('This range exceeds 5,000 events. Choose a shorter date range; no partial chart is shown.',413);
   if(data.length<1000)break;
  }
 }
 const events=(await parallel(paths,async path=>{const {data,error}=await files.download(path);if(error||!data)throw new PersonaError('An analytics event could not be read',503);
  const raw=await data.text();if(raw.length>32768)throw new PersonaError('Invalid analytics event',503);const event=JSON.parse(raw);
  if(event.schema!==1||!UUID.test(event.id)||!Number.isFinite(Date.parse(event.at))||!['answered','fallback','needs_detail','unavailable','safety','redirected'].includes(event.outcome)||event.artifact&&(!/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(event.artifact.id)||!['en','zh'].every(k=>typeof event.artifact[k]==='string'&&event.artifact[k].length<=500)))throw new PersonaError('Invalid analytics event',503);
  return event;
 })).filter(e=>e.personaId===personaId&&e.traffic===traffic&&e.at>=start&&e.at<end);
 const questions=new Map();
 for(let i=0;i<events.length;i+=100){const ids=events.slice(i,i+100).map(e=>e.id);const rows=await database('messages?select=id,content,conversations!inner(persona_id)&role=eq.user&conversations.persona_id=eq.'+encodeURIComponent(personaId)+'&id=in.('+ids.join(',')+')');for(const row of rows)questions.set(row.id,row.content);}
 const admins=adminIds();
 const trafficFilter=admins.length?'&conversations.user_id='+(traffic==='test'?'in.':'not.in.')+'('+admins.join(',')+')':traffic==='test'?'&conversations.user_id=eq.00000000-0000-0000-0000-000000000000':'';
 const expected=await database('messages?select=id,conversations!inner(persona_id,user_id)&role=eq.user&conversations.persona_id=eq.'+encodeURIComponent(personaId)+trafficFilter+'&created_at=gte.'+encodeURIComponent(start)+'&created_at=lt.'+encodeURIComponent(end),{head:true});
 return summarizeEvents(events,questions,{from,to,startedAt:config.startedAt,expected,asOf:end});
}
