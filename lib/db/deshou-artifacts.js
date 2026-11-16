/** Server-side catalogue reader. Never import this module into a client component. */
import { tourWaypoint } from '../museum-tour-state.js';
async function read(table,parameters,env=process.env){
 const base=new URL(env.SUPABASE_URL);
 if(base.protocol!=='https:') throw new Error('Catalogue requires HTTPS');
 const key=env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
 if(!key) throw new Error('Catalogue is not configured');
 const url=new URL('/rest/v1/'+table,base);url.search=new URLSearchParams(parameters).toString();
 const response=await fetch(url,{headers:{apikey:key,Authorization:`Bearer ${key}`},cache:'no-store',signal:AbortSignal.timeout(10000)});
 if(!response.ok) throw new Error('Catalogue unavailable');
 const rows=await response.json();if(!Array.isArray(rows)) throw new Error('Invalid catalogue');return rows;
}
export async function getArtifactsByHall(exhibitionHall,env=process.env){
 if(typeof exhibitionHall!=='string'||!exhibitionHall.trim()) throw new Error('A hall is required');
 return readArtifacts(exhibitionHall,env);
}
async function readArtifacts(hall,env){
 const result=[];
 for(let offset=0;offset<10000;offset+=500){
  const rows=await read('deshou_artifacts',{select:'*',...(hall?{exhibition_hall:`eq.${hall}`} : {}),order:'exhibition_hall.asc,display_order.asc,id.asc',limit:'500',offset:String(offset)},env);
  result.push(...rows);if(rows.length<500)return result;
 }
 throw new Error('Catalogue exceeds pagination limit');
}
export function groupArtifactsByHall(halls,rows){
 return [...halls].sort((a,b)=>a.display_order-b.display_order||a.id.localeCompare(b.id)).map(hall=>({
  id:hall.id,name:{en:hall.name_en,zh:hall.name_zh},
  summary:{en:'A sourced thematic tour; individual display locations are not verified.',zh:'依据文献编排的主题导览，单件展品陈列位置尚未逐一核实。'},
  artifacts:rows.filter(row=>row.hall_id===hall.id&&row.exhibition_hall===hall.name_en)
   .sort((a,b)=>a.display_order-b.display_order||a.id.localeCompare(b.id))
   .map((row,index)=>({...row,name:{en:row.name_en,zh:row.name_zh},description:{en:row.description_en,zh:row.description_zh},waypoint:tourWaypoint(index)}))
 })).filter(hall=>hall.artifacts.length);
}
export async function getGroupedArtifactCatalogue(env=process.env){
 const [halls,rows]=await Promise.all([read('deshou_exhibition_halls',{select:'*',order:'display_order.asc,id.asc'},env),readArtifacts(null,env)]);
 const grouped=groupArtifactsByHall(halls,rows);return {halls:grouped,records:grouped.flatMap(hall=>hall.artifacts)};
}
