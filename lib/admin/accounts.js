import {PersonaError,adminIds} from '../personas/index.js';
import {classifyInput} from '../ai/safety.js';
import {redactSensitiveText} from '../ai/input-normalization.js';
import {analyticsBucket} from './analytics.js';
export const USER_ID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
async function service(path,{method='GET',body,auth=false,head=false,key,metadata=false}={}){
 const base=new URL(process.env.SUPABASE_URL);if(base.protocol!=='https:')throw new PersonaError('Account service unavailable',503);
 const credential=key||process.env.SUPABASE_SERVICE_ROLE_KEY;if(!credential)throw new PersonaError('Account service unavailable',503);
 const r=await fetch(base.origin+(auth?'/auth/v1/':'/rest/v1/')+path,{method:head?'HEAD':method,headers:{apikey:credential,Authorization:'Bearer '+credential,'Content-Type':'application/json',Prefer:'count=exact'},...(body?{body:JSON.stringify(body)}:{}),redirect:'error',cache:'no-store',signal:AbortSignal.timeout(12000)});
 if(!r.ok)throw new PersonaError(r.status===429?'Recovery requests are rate limited. Retry later.':'Account service request failed',r.status===429?429:503);
 if(head){const value=r.headers.get('content-range')?.split('/')[1];if(!/^\d+$/.test(value||''))throw new PersonaError('Usage count unavailable',503);return Number(value);}
 const reader=r.body?.getReader(),chunks=[];let bytes=0;if(reader){try{for(;;){const {done,value}=await reader.read();if(done)break;bytes+=value.length;if(bytes>2097152){await reader.cancel();throw new PersonaError('Account response too large',503);}chunks.push(value);}}finally{reader.releaseLock();}}
 const raw=Buffer.concat(chunks).toString('utf8'),value=raw?JSON.parse(raw):{};
 if(metadata){const count=r.headers.get('x-total-count'),link=r.headers.get('link');return {...value,_count:/^\d+$/.test(count||'')?Number(count):null,_hasNext:link===null?null:/rel=["']?next/i.test(link)};}return value;
}
export async function accountDirectory(){
 const users=[],seen=new Set();const admins=adminIds();let declaredTotal=null;
 for(let page=1;page<=51;page++){
  const data=await service('admin/users?page='+page+'&per_page=200',{auth:true,metadata:true});
  if(data._count!==null){if(declaredTotal!==null&&declaredTotal!==data._count)throw new PersonaError('Account listing changed; refresh',503);declaredTotal=data._count;}
  if(!Array.isArray(data.users))throw new PersonaError('Invalid account listing',503);
  for(const user of data.users){if(!USER_ID.test(user.id)||seen.has(user.id))throw new PersonaError('Account listing changed; refresh',503);seen.add(user.id);
   users.push({id:user.id,email:typeof user.email==='string'?user.email.slice(0,254):'',createdAt:user.created_at,lastSignIn:user.last_sign_in_at||null,confirmed:!!user.email_confirmed_at,anonymous:user.is_anonymous===true,administrator:admins.has(user.id.toLowerCase())});}
  if(users.length>10000)throw new PersonaError('Account directory exceeds this release’s 10,000-account limit',413);
  if(data._hasNext===false||data._hasNext===null&&data.users.length<200){if(declaredTotal!==null&&declaredTotal!==users.length)throw new PersonaError('Account listing incomplete; refresh',503);const actualAdmins=users.filter(u=>u.administrator).length;return {users,total:users.length,registered:users.filter(u=>!u.anonymous).length,administrators:actualAdmins,regularUsers:users.filter(u=>!u.anonymous&&!u.administrator).length,unmatchedAdministratorIds:[...admins].filter(id=>!seen.has(id)).length,asOf:new Date().toISOString()};}
 }
 throw new PersonaError('Account listing incomplete; no partial totals are shown',503);
}
export async function userUsage(userId,now=new Date()){
 if(!USER_ID.test(userId))throw new PersonaError('Invalid user ID');
 const user=await service('admin/users/'+userId,{auth:true});if(user.id!==userId)throw new PersonaError('Account unavailable',404);
 const filter='messages?select=id,conversations!inner(user_id)&role=eq.user&conversations.user_id=eq.'+userId;
 const [total,day,week,month,conversations]=await Promise.all([service(filter,{head:true}),... [1,7,30].map(days=>service(filter+'&created_at=gte.'+encodeURIComponent(new Date(now.getTime()-days*86400000).toISOString()),{head:true})),service('conversations?select=id&user_id=eq.'+userId,{head:true})]);
 return {userId,total,day,week,month,conversations,asOf:now.toISOString()};
}
export function guardrailReview(rows,{now=new Date(),total=rows.length}={}){
 const byUser=new Map(),seen=new Set();let reviewed=0;
 for(const row of rows){if(seen.has(row.id))continue;seen.add(row.id);const owner=row.conversations?.user_id;
  if(!USER_ID.test(owner||'')||typeof row.content!=='string'||!Number.isFinite(Date.parse(row.created_at)))throw new PersonaError('Invalid review record',503);
  reviewed++;if(classifyInput(row.content).status!=='blocked')continue;
  const entry=byUser.get(owner)||{userId:owner,day:0,month:0,examples:[]};entry.month++;if(Date.parse(row.created_at)>=now.getTime()-86400000)entry.day++;
  if(entry.examples.length<5)entry.examples.push({at:row.created_at,excerpt:redactSensitiveText(row.content,{maxCharacters:1500}).slice(0,200)});byUser.set(owner,entry);
 }
 return {asOf:now.toISOString(),windowDays:30,reviewed,total,complete:reviewed===total,method:'Current deterministic input detector applied retrospectively to saved questions; not historical enforcement logs.',warnings:[...byUser.values()].filter(u=>u.day>=3||u.month>=5).sort((a,b)=>b.day-a.day||b.month-a.month)};
}
export async function securityReview(now=new Date()){
 const start=new Date(now.getTime()-30*86400000).toISOString(),end=now.toISOString();
 const filter='messages?select=id,content,created_at,conversations!inner(user_id)&role=eq.user&created_at=gte.'+encodeURIComponent(start)+'&created_at=lt.'+encodeURIComponent(end);
 const total=await service(filter,{head:true}),rows=[];
 for(let offset=0;offset<Math.min(total,5000);offset+=500){const page=await service(filter+'&order=created_at.desc,id.desc&limit=500&offset='+offset);if(!Array.isArray(page))throw new PersonaError('Security review unavailable',503);rows.push(...page);if(page.length<500)break;}
 return guardrailReview(rows,{now,total});
}
export async function sendRecovery(userId,actorId,origin,now=new Date()){
 if(!USER_ID.test(userId))throw new PersonaError('Invalid user ID');
 const user=await service('admin/users/'+userId,{auth:true});if(user.id!==userId||!user.email||user.is_anonymous)throw new PersonaError('This account has no recovery email',400);
 // An immutable five-minute slot prevents repeated sends across server instances.
 const files=await analyticsBucket();const slot=Math.floor(now.getTime()/300000),id=userId+'-'+slot;
 const claimed=await files.upload('administration/recovery/'+id+'.json',JSON.stringify({actorId,targetId:userId,at:now.toISOString(),action:'recovery_requested'}),{contentType:'application/json',upsert:false});
 if(claimed.error)throw new PersonaError('Recovery was recently requested or audit storage is unavailable. Retry after five minutes.',429);
 try{await service('recover?redirect_to='+encodeURIComponent(origin+'/reset-password'),{auth:true,method:'POST',body:{email:user.email},key:process.env.SUPABASE_PUBLISHABLE_KEY});}
 catch(error){await files.upload('administration/recovery/'+id+'-failed.json',JSON.stringify({actorId,targetId:userId,at:new Date().toISOString(),action:'recovery_failed'}),{contentType:'application/json',upsert:false});throw error;}
 return {accepted:true,message:'Recovery email requested. Delivery depends on Supabase email configuration; the user must open the link and choose their own password.'};
}
