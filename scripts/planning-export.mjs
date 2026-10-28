import {readFile,writeFile} from 'node:fs/promises';
import {validateDestinationRecords} from '../lib/db/planning.js';
const read=async file=>JSON.parse(await readFile(new URL('../data/'+file,import.meta.url),'utf8'));
const quote=value=>"'"+String(value).replaceAll("'","''")+"'";
const sources=await read('travel-knowledge-sources.json');
const cities=validateDestinationRecords(await read('travel-destinations.json'));
const routes=validateDestinationRecords(await read('travel-itinerary-routes.json'));
const definitions=[
 {table:'travel_knowledge_sources',columns:['id','title','url','kind','checked_on','evidence_scope'],rows:sources.map(r=>[r.id,r.title,r.url,r.kind,r.checked_on,r.evidence_scope])},
 {table:'travel_destinations',columns:['id','name_en','name_zh','payload','checked_on'],rows:cities.map(r=>[r.id.toLowerCase(),r.name_en,r.name_zh,JSON.stringify(r),r.research.checked_on])},
 {table:'travel_itinerary_routes',columns:['id','payload','checked_on'],rows:routes.map(r=>[r.id,JSON.stringify(r),r.research.checked_on])}
];
let sql='-- Apply knowledge-schema.sql first. Original suggestions, not live tour inventory.\nBEGIN;\n';
for(const d of definitions)sql+='INSERT INTO public.'+d.table+' ('+d.columns.join(',')+') VALUES\n'+d.rows.map(row=>'('+row.map(quote).join(',')+')').join(',\n')+'\nON CONFLICT (id) DO UPDATE SET '+d.columns.slice(1).map(c=>c+'=excluded.'+c).join(',')+';\n';
sql+='COMMIT;\n';
await writeFile(new URL('../supabase/planning-seed.sql',import.meta.url),sql);
console.log(JSON.stringify({exported:'supabase/planning-seed.sql',sources:sources.length,destinations:cities.length,routes:routes.length}));
