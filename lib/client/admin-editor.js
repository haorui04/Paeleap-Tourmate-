export function nextDraft(profile,latestVersion){
  return {...structuredClone(profile),version:latestVersion+1};
}
export function draftKey(userId,personaId){return "tourmate-admin-draft:"+userId+":"+personaId;}
export function parseBrowserDraft(raw,id){
  if(typeof raw!=="string"||raw.length>3*1024*1024)throw Error("Invalid browser draft");
  const saved=JSON.parse(raw),p=saved?.payload;
  const text=value=>typeof value==="string";
  if(p?.id!==id||!Number.isSafeInteger(saved.latest)||saved.latest<0||
    !["name","venue","role","greeting"].every(key=>p[key]&&text(p[key].en)&&text(p[key].zh))||
    !["professional","warm","child_friendly"].includes(p.tone)||!Array.isArray(p.scope)||!p.scope.every(text)||
    !Array.isArray(p.knowledge)||p.knowledge.length>2000||
    !p.knowledge.every(row=>row&&["id","question_en","question_zh","answer_en","answer_zh"].every(key=>text(row[key]))&&
      Array.isArray(row.sources)&&row.sources.length<=6&&row.sources.every(s=>s&&text(s.name)&&text(s.url))))throw Error("Invalid browser draft");
  return saved;
}
export function filterKnowledge(records,query){
  const term=query.trim().toLocaleLowerCase();
  return records.map((record,index)=>({record,index})).filter(({record})=>!term||[record.id,record.question_en,record.question_zh,record.answer_en,record.answer_zh].some(value=>String(value).toLocaleLowerCase().includes(term)));
}
export function newKnowledgeRecord(){
  return {id:"K"+crypto.randomUUID().replaceAll("-",""),question_en:"",question_zh:"",answer_en:"",answer_zh:"",sources:[]};
}
export function mergeKnowledge(current,incoming,replace=false){
  if(!Array.isArray(incoming)||!incoming.length)throw Error("No knowledge records to import");
  const records=new Map((replace?[]:current).map(row=>[row.id,row]));
  incoming.forEach(row=>records.set(row.id,structuredClone(row)));
  if(records.size>2000)throw Error("A profile can contain at most 2,000 knowledge records");
  return Array.from(records.values());
}
