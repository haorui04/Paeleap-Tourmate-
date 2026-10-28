import {readFile,writeFile} from 'node:fs/promises';
import {CHINA_TOURISM_FAQS,LEGACY_TOURISM_FAQS} from '../data/china-tourism-faq.js';
import {validateFaqBank} from '../lib/db/faq.js';
import {validateDestinationRecords} from '../lib/db/planning.js';
import {classifyInput,validateOutput} from '../lib/ai/safety.js';
import {matchFaqOffline} from '../lib/tourism/faq-matching.js';
const read=async file=>JSON.parse(await readFile(new URL('../data/'+file,import.meta.url),'utf8'));
const sources=await read('travel-knowledge-sources.json');
const destinations=validateDestinationRecords(await read('travel-destinations.json'));
const routes=validateDestinationRecords(await read('travel-itinerary-routes.json'));
const ids=new Set(sources.map(s=>s.id));
const rows=validateFaqBank(CHINA_TOURISM_FAQS),errors=[];
const categories={};
for(const row of rows){
 categories[row.category]=(categories[row.category]||0)+1;
 for(const language of ['en','zh']){
  const q=row['question_'+language],a=row['answer_'+language];
  if(classifyInput(q,language).status!=='allowed')errors.push({id:row.id,language,check:'input_safety'});
  if(validateOutput(a,language).status!=='allowed')errors.push({id:row.id,language,check:'output_safety'});
  if(matchFaqOffline(q,rows)?.faqId!==row.id)errors.push({id:row.id,language,check:'exact_retrieval'});
 }
 if(Number(row.id.slice(2))>100){
  if(!row.sources.length||!row.research?.source_ids?.length)errors.push({id:row.id,check:'missing_provenance'});
  for(const id of row.research?.source_ids||[])if(!ids.has(id))errors.push({id:row.id,check:'unknown_source_id',source:id});
 }
}
const summary={checked_on:new Date().toISOString(),faq_count:rows.length,legacy_retained:LEGACY_TOURISM_FAQS.length,new_faqs:rows.length-LEGACY_TOURISM_FAQS.length,destinations:destinations.length,multi_city_routes:routes.length,source_discovery_catalog:sources.length,categories,errors};
console.log(JSON.stringify(summary,null,2));
if(process.argv.includes('--write'))await writeFile(new URL('../data/knowledge-quality.json',import.meta.url),JSON.stringify(summary,null,2)+'\n');
if(errors.length)process.exitCode=1;
