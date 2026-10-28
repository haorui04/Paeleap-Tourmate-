import { readFile } from 'node:fs/promises';
import { hasConfiguredValue } from '../config.js';
import { normalizeQuestion } from '../tourism/faq-matching.js';

export function isPlanningRequest(message) {
  return /\b(?:itinerar(?:y|ies)|itinarary|plan|route|schedule|how many days|places to (?:visit|see)|what to see|things to do|what (?:should|can) (?:i|we) (?:visit|see)|where (?:should|can) (?:i|we) go|days in)\b|行程|路线|路線|规划|規劃|旅游计划|旅行计划|旅遊計劃|旅行計劃|怎么玩|怎麼玩|玩.{0,5}天|推荐.{0,6}景点|推薦.{0,6}景點/i.test(message);
}
async function readKnowledge(table,localName) {
  if(process.env.NODE_ENV!=='production'&&(process.env.FAQ_BANK_SOURCE||'local')==='local')return JSON.parse(await readFile(new URL('../../data/'+localName,import.meta.url),'utf8'));
  if(![process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY].every(hasConfiguredValue))throw new Error('Planning database not configured');
  const url=new URL(process.env.SUPABASE_URL);
  if(url.protocol!=='https:'&&!(process.env.NODE_ENV!=='production'&&['localhost','127.0.0.1'].includes(url.hostname)))throw new Error('Invalid planning database URL');
  url.pathname='/rest/v1/'+table;url.search='select=payload&order=id.asc&limit=101';
  const response=await fetch(url,{headers:{apikey:process.env.SUPABASE_SERVICE_ROLE_KEY,Authorization:'Bearer '+process.env.SUPABASE_SERVICE_ROLE_KEY},cache:'no-store',redirect:'error',signal:AbortSignal.timeout(10000)});
  if(!response.ok)throw new Error('Planning database unavailable');
  const reader=response.body?.getReader();if(!reader)throw new Error('Invalid planning database response');
  const chunks=[];let size=0;
  try{for(;;){const{value,done}=await reader.read();if(done)break;size+=value.length;if(size>2*1024*1024){await reader.cancel();throw new Error('Planning database response too large');}chunks.push(value);}}finally{reader.releaseLock();}
  const rows=JSON.parse(Buffer.concat(chunks).toString('utf8'));
  if(!Array.isArray(rows)||rows.length>100)throw new Error('Invalid planning database response');
  return rows.map(row=>row.payload);
}
export function validateDestinationRecords(rows) {
 if(!Array.isArray(rows)||rows.length>100)throw new Error('Invalid destination library');
 const ids=new Set();
 for(const row of rows){
  if(!row||!/^DEST_[A-Z0-9_]{2,50}$/.test(row.id)||ids.has(row.id))throw new Error('Invalid destination identity');ids.add(row.id);
  for(const key of ['category','question_en','question_zh','answer_en','answer_zh'])if(typeof row[key]!=='string'||!row[key].trim()||row[key].length>6000)throw new Error('Invalid destination text');
  if(!Array.isArray(row.aliases)||row.aliases.some(v=>typeof v!=='string'||v.length>100))throw new Error('Invalid destination aliases');
  if(!Array.isArray(row.city_aliases)||!row.city_aliases.length||row.city_aliases.length>12||row.city_aliases.some(v=>typeof v!=='string'||!v.trim()||v.length>150))throw new Error('Invalid city aliases');
  if(!Array.isArray(row.sources)||row.sources.length>10||row.sources.some(s=>!s||typeof s.name!=='string'||!/^https:\/\//.test(s.url)))throw new Error('Invalid destination sources');
 }
 return rows;
}
function mentions(message,alias){const n=normalizeQuestion(message),a=normalizeQuestion(alias);if(!a)return false;return /\p{Script=Han}/u.test(a)?n.includes(a):(' '+n+' ').includes(' '+a+' ');}
export function selectPlanningRecords(message,records,history=[]){
 if(!isPlanningRequest(message))return [];
 let selected=records.filter(row=>row.city_aliases?.some(alias=>mentions(message,alias)));
 if(!selected.length){for(const previous of history.slice(-6).reverse().filter(turn=>turn.role==='user'&&typeof turn.content==='string')){selected=records.filter(row=>row.city_aliases?.some(alias=>mentions(previous.content,alias)));if(selected.length)break;}}
 return selected.slice(0,4);
}
export async function getPlanningReferences(message,history=[]){
 if(!isPlanningRequest(message))return [];
 const cities=validateDestinationRecords(await readKnowledge('travel_destinations','travel-destinations.json'));
 const selected=selectPlanningRecords(message,cities,history);
 if(selected.length)return selected;
 if(/\b(?:china|multi.?city|silk road|yunnan|greater bay|hainan)\b|中国|多城|丝绸之路|絲綢之路|云南|雲南|大湾区|大灣區|海南/i.test(message)){
  const routes=validateDestinationRecords(await readKnowledge('travel_itinerary_routes','travel-itinerary-routes.json'));
  const matches=routes.filter(row=>row.city_aliases.some(alias=>mentions(message,alias)));
  return (matches.length?matches:routes).slice(0,3);
 }
 return [];
}
