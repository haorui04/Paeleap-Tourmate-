"use client";
import {useEffect,useRef,useState} from "react";
import {draftKey,filterKnowledge,mergeKnowledge,nextDraft,newKnowledgeRecord,parseBrowserDraft} from "../lib/client/admin-editor.js";
import KnowledgeConnector from "./KnowledgeConnector.jsx";

export default function PersonaEditor({profiles,client,userId,language,onPublished}){
 const zh=language==="zh",say=(en,cn)=>zh?cn:en;
 const [draft,setDraft]=useState(null),[versions,setVersions]=useState([]),[latest,setLatest]=useState(0);
 const [tab,setTab]=useState("persona"),[query,setQuery]=useState(""),[selected,setSelected]=useState(0);
 const [busy,setBusy]=useState(false),[dirty,setDirty]=useState(false),[review,setReview]=useState(false),[message,setMessage]=useState("");
 const serial=useRef(0),live=useRef(true);
 useEffect(()=>{live.current=true;return()=>{live.current=false;serial.current++;};},[]);
 useEffect(()=>{const warn=event=>{if(dirty){event.preventDefault();event.returnValue="";}};window.addEventListener("beforeunload",warn);return()=>window.removeEventListener("beforeunload",warn);},[dirty]);
 const askDiscard=()=>!dirty||window.confirm(say("Discard unsaved changes? Save your browser draft first to keep them.","放弃未保存的修改？可先保存浏览器草稿。"));
 async function api(path,method="GET",body){
  const {data}=await client.auth.getSession();if(!data.session?.access_token)throw Error(say("Sign in again.","请重新登录。"));
  const response=await fetch(path,{method,cache:"no-store",headers:{Authorization:"Bearer "+data.session.access_token,...(body?{"Content-Type":"application/json"}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(30000)});
  const value=await response.json();if(!response.ok)throw Error(value.error?.message||say("Request failed.","请求失败。"));return value;
 }
 async function load(id,version){
  if(busy||!id||!askDiscard())return;const ticket=++serial.current;setBusy(true);setMessage("");
  try{
   const value=await api("/api/admin/personas/history?personaId="+encodeURIComponent(id)+(version?"&version="+version:""));
   if(!live.current||ticket!==serial.current)return;
   const current=value.versions[0]?.version||value.persona.version;
   setLatest(current);setVersions(value.versions);setDraft(nextDraft(value.persona,current));setSelected(0);setReview(false);setDirty(false);setQuery("");
   setMessage(version?say("Historical content loaded as a new draft. Review before publishing.","已将历史内容载入新草稿，请审核后再发布。"):"");
  }catch(error){if(live.current&&ticket===serial.current)setMessage(error.message);}
  finally{if(live.current&&ticket===serial.current)setBusy(false);}
 }
 function change(fn){setDraft(old=>fn(structuredClone(old)));setDirty(true);setReview(false);setMessage("");}
 function field(key,lang,value){change(d=>{if(lang)d[key][lang]=value;else d[key]=value;return d;});}
 function rowField(key,value){change(d=>{d.knowledge[selected][key]=value;return d;});}
 function save(){
  try{localStorage.setItem(draftKey(userId,draft.id),JSON.stringify({payload:draft,latest}));localStorage.setItem("tourmate-admin-last:"+userId,draft.id);setDirty(false);setMessage(say("Saved in this browser only. Not published or shared.","已保存在此浏览器中，尚未发布，也不会跨设备同步。"));}
  catch{setMessage(say("Browser storage is full or unavailable. Export JSON to keep your work.","浏览器存储不足或不可用，请导出 JSON 备份。"));}
 }
 function resume(){
  if(!askDiscard())return;
  try{
   const id=draft?.id||localStorage.getItem("tourmate-admin-last:"+userId);if(!id)throw Error(say("No browser draft for this account.","当前账号没有浏览器草稿。"));
   const raw=localStorage.getItem(draftKey(userId,id));if(!raw)throw Error(say("No browser draft for this profile/account.","当前账号与角色没有浏览器草稿。"));
   const saved=parseBrowserDraft(raw,id),current=profiles.find(p=>p.id===id)?.version||0;
   setLatest(current);setVersions([]);setDraft(nextDraft(saved.payload,current));setReview(false);setDirty(true);setSelected(0);setQuery("");
   setMessage(saved.latest!==current?say("A newer version was published. Compare this draft before publishing.","已存在较新的发布版本，请核对草稿后再发布。"):say("Browser draft restored. Select the profile again to reload version history.","已恢复浏览器草稿，可重新选择场馆以载入版本历史。"));
  }catch(error){setMessage(error.message);}
 }
 function create(){
  if(busy||!askDiscard())return;
  const id=window.prompt(say("New museum ID: lowercase letters, numbers and hyphens (e.g. city-museum).","新场馆 ID：小写英文字母、数字及连字符，如 city-museum。"));
  if(!id)return;if(!/^[a-z][a-z0-9-]{1,63}$/.test(id)||id==="tourmate"||profiles.some(p=>p.id===id)){setMessage(say("Choose a unique museum ID.","请使用未占用的场馆 ID。"));return;}
  setDraft({id,version:1,name:{en:"",zh:""},venue:{en:"",zh:""},role:{en:"",zh:""},tone:"professional",greeting:{en:"",zh:""},scope:[],knowledge:[newKnowledgeRecord()]});
  setLatest(0);setVersions([]);setSelected(0);setQuery("");setDirty(true);setReview(false);setTab("persona");setMessage("");
 }
 async function publish(){
  if(!draft||!review||busy)return;const ticket=++serial.current;setBusy(true);setMessage("");
  try{
   const value=await api("/api/admin/personas","POST",{...draft,scope:draft.scope.map(topic=>topic.trim()).filter(Boolean)});
   if(!live.current||ticket!==serial.current)return;
   setLatest(value.persona.version);setDraft(nextDraft(value.persona,value.persona.version));setReview(false);setDirty(false);
   // Publication succeeded even if refreshing history or clearing local storage fails.
   try{localStorage.removeItem(draftKey(userId,value.persona.id));}catch{}
   setVersions(old=>[{version:value.persona.version,published_at:new Date().toISOString()},...old]);
   setMessage(say("Published successfully. New conversations use this version; existing conversations keep their pinned version.","发布成功。新对话使用新版本，现有对话保留原绑定版本。"));onPublished();
  }catch(error){if(live.current&&ticket===serial.current)setMessage(error.message);}
  finally{if(live.current&&ticket===serial.current)setBusy(false);}
 }
 function download(){
  const url=URL.createObjectURL(new Blob([JSON.stringify(draft,null,2)],{type:"application/json"}));
  const a=document.createElement("a");a.href=url;a.download=draft.id+"-v"+draft.version+"-draft.json";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 const rows=draft?filterKnowledge(draft.knowledge,query):[],record=draft?.knowledge[selected];
 return <section className="admin-card admin-editor" aria-label={say("Visual administration editor","可视化管理编辑器")}>
  <div className="studio-heading"><div><p className="section-kicker">TOURMATE ADMINISTRATION</p><h2>{say("Your museum workspace","场馆管理工作台")}</h2><p>{say("Manage your assistant’s identity and the knowledge behind every answer.","管理助手的角色设定与回答所依据的知识资料。")}</p></div><span className="source-status">{say("Administrator","管理员")}</span></div>
  <ol className="admin-steps"><li>{say("Choose a museum","选择场馆")}</li><li>{say("Edit persona & knowledge","编辑角色与知识")}</li><li>{say("Review & publish","审核并发布")}</li></ol>
  <div className="editor-toolbar">
   <label>{say("Museum profile","场馆角色")}<select value={draft?.id||""} disabled={busy} onChange={e=>load(e.target.value)}>
    <option value="">{say("Select a museum…","请选择场馆…")}</option>{profiles.filter(p=>p.id!=="tourmate").map(p=><option key={p.id} value={p.id}>{p.name[language]}</option>)}
    {draft&&!profiles.some(p=>p.id===draft.id)&&<option value={draft.id}>{draft.id}</option>}
   </select></label>
   <button type="button" disabled={busy} onClick={create}>{say("Create museum persona","创建场馆角色")}</button>
   <button type="button" disabled={busy} onClick={resume}>{say("Resume last browser draft","恢复上次浏览器草稿")}</button>
  </div>
  {message&&<p role="status" className="notice">{message}</p>}
  {!draft&&<div className="studio-empty"><h3>{say("Choose an assistant to get started","选择一个助手开始管理")}</h3><p>{say("Open a museum below, or create a new persona. Published content remains active while you work on a draft.","选择下方场馆或创建新角色。编辑草稿期间，已发布内容仍正常提供服务。")}</p><div className="studio-profiles">{profiles.filter(p=>p.id!=="tourmate").map(p=><button type="button" key={p.id} disabled={busy} onClick={()=>load(p.id)}><strong>{p.name[language]}</strong><span>{p.venue[language]}</span><small>v{p.version} · {p.recordCount} {say("knowledge records","条知识记录")} →</small></button>)}</div></div>}
  {draft&&<fieldset disabled={busy} className="editor-fieldset">
   <legend>{draft.id} · {say("Draft version","草稿版本")} {draft.version} {dirty?say("· Unsaved","· 未保存"):""}</legend>
   <div className="editor-toolbar">
    <button type="button" onClick={save}>{say("Save browser draft","保存浏览器草稿")}</button>
    <button type="button" onClick={resume}>{say("Resume browser draft","恢复浏览器草稿")}</button>
    <button type="button" onClick={download}>{say("Export JSON backup","导出 JSON 备份")}</button>
   </div>
   <p className="admin-smallprint">{say("Browser drafts stay on this device and account. Export a backup before clearing browser data. Do not enter secrets or visitor information.","浏览器草稿仅保存在本设备并按账号区分。清理浏览器数据前请导出备份。请勿输入密钥或访客隐私。")}</p>
   <nav className="editor-toolbar editor-tabs" aria-label={say("Editor sections","编辑栏目")}>{[["persona","Persona","角色"],["sources","Knowledge sources","知识来源"],["knowledge","Knowledge","知识"],["preview","Review & publish","审核与发布"],["history","Version history","版本历史"]].map(([id,en,cn])=><button type="button" key={id} aria-pressed={tab===id} onClick={()=>setTab(id)}>{say(en,cn)}</button>)}</nav>
   {tab==="sources"&&<KnowledgeConnector key={draft.id} api={api} profiles={profiles} language={language} onImport={(records,replace)=>{const merged=mergeKnowledge(draft.knowledge,records,replace);change(d=>{d.knowledge=merged;return d;});setSelected(0);setQuery("");}}/>}
   {tab==="persona"&&<div className="editor-fields">
    {["name","venue","role","greeting"].flatMap(key=>["en","zh"].map(lang=><label key={key+lang}>{({name:say("Assistant name","助手名称"),venue:say("Museum","场馆"),role:say("Role","角色定义"),greeting:say("Greeting","欢迎语")})[key]} ({lang==="en"?"English":"中文"})
     <textarea rows={key==="role"?4:2} maxLength={{name:80,venue:160,role:1600,greeting:800}[key]} value={draft[key][lang]} onChange={e=>field(key,lang,e.target.value)} /></label>))}
    <label>{say("Tone","语气")}<select value={draft.tone} onChange={e=>field("tone",null,e.target.value)}>{["professional","warm","child_friendly"].map(t=><option key={t}>{t}</option>)}</select></label>
    <label>{say("Allowed topics — one per line","服务范围，每行一项")}<textarea rows={5} value={draft.scope.join("\n")} onChange={e=>field("scope",null,e.target.value.split("\n"))}/></label>
   </div>}
   {tab==="knowledge"&&<>
    <div className="editor-toolbar"><label>{say("Search knowledge","搜索知识")}<input value={query} onChange={e=>setQuery(e.target.value)}/></label>
     <button type="button" disabled={draft.knowledge.length>=2000} onClick={()=>{setSelected(draft.knowledge.length);setQuery("");change(d=>{d.knowledge.push(newKnowledgeRecord());return d;});}}>{say("Add record","添加记录")}</button>
     <span>{draft.knowledge.length} / 2000</span>
    </div>
    <div className="editor-knowledge">
     <div className="editor-records">{rows.slice(0,50).map(({record:r,index})=><button type="button" key={index} aria-pressed={selected===index} onClick={()=>setSelected(index)}>{r.id} · {r["question_"+language]||say("Untitled","未命名")}</button>)}
      {!rows.length&&<p>{say("No matches.","没有匹配记录。")}</p>}{rows.length>50&&<p>{say("Showing 50 results. Refine your search.","仅显示前 50 条，请缩小搜索范围。")}</p>}
     </div>
     {record&&<div className="editor-fields"><label>{say("Record ID (unique)","记录 ID（必须唯一）")}<input maxLength={64} value={record.id} onChange={e=>rowField("id",e.target.value)}/></label>
      {["question_en","question_zh","answer_en","answer_zh"].map(key=><label key={key}>{({question_en:say("Question / artifact name (English)","问题／文物名称（英文）"),question_zh:say("Question / artifact name (Chinese)","问题／文物名称（中文）"),answer_en:say("Description / answer (English)","说明／答案（英文）"),answer_zh:say("Description / answer (Chinese)","说明／答案（中文）")})[key]}
       <textarea rows={key.startsWith("answer")?6:2} maxLength={key.startsWith("answer")?1600:500} value={record[key]} onChange={e=>rowField(key,e.target.value)}/></label>)}
      <h3>{say("Reference sources","参考来源")}</h3>
      {record.sources.map((source,index)=><div key={index} className="editor-source">
       <label>{say("Source title","来源名称")}<input maxLength={160} value={source.name} onChange={e=>{const sources=structuredClone(record.sources);sources[index].name=e.target.value;rowField("sources",sources);}}/></label>
       <label>HTTPS URL<input type="url" value={source.url} onChange={e=>{const sources=structuredClone(record.sources);sources[index].url=e.target.value;rowField("sources",sources);}}/></label>
       <button type="button" onClick={()=>rowField("sources",record.sources.filter((_,i)=>i!==index))}>{say("Remove source","移除来源")}</button>
      </div>)}
      <button type="button" disabled={record.sources.length>=6} onClick={()=>rowField("sources",[...record.sources,{name:"",url:""}])}>{say("Add source","添加来源")}</button>
      <button type="button" onClick={()=>{if(window.confirm(say("Remove this record from the draft? Published history is retained.","从草稿移除此记录？历史发布版本会保留。"))){change(d=>{d.knowledge.splice(selected,1);return d;});setSelected(0);}}}>{say("Remove record from draft","从草稿移除记录")}</button>
     </div>}
    </div>
   </>}
   {tab==="preview"&&<>
    <h3>{draft.name[language]} · {draft.venue[language]}</h3><p>{draft.role[language]}</p><blockquote>{draft.greeting[language]}</blockquote>
    <p>{say("Scope","服务范围")}: {draft.scope.join(" · ")}</p><p>{draft.knowledge.length} {say("knowledge records","条知识记录")} · {say("Publishing version","待发布版本")} {draft.version}</p>
    <div className="editor-review">{draft.knowledge.map((r,index)=><details key={index}><summary>{r.id} · {r["question_"+language]}</summary><p>{r["answer_"+language]}</p>{r.sources.map((s,i)=><p key={i}>{s.name} — {s.url}</p>)}</details>)}</div>
    <p>{say("Server validation rejects unsafe instructions, secrets, duplicate records and invalid sources. Persona edits cannot override platform guardrails.","服务端会拒绝危险指令、密钥、重复记录及无效来源。角色编辑不能覆盖平台安全规则。")}</p>
    <label className="admin-confirm"><input type="checkbox" checked={review} onChange={e=>setReview(e.target.checked)}/>{say("I reviewed both languages, all records, sources and scope and approve publication.","我已审核双语内容、全部记录、来源及服务范围，确认可以发布。")}</label>
    <button type="button" className="primary-button" disabled={!review||busy} onClick={publish}>{say("Publish reviewed version","发布已审核版本")}</button>
   </>}
   {tab==="history"&&<><p>{say("Restore loads old content into a new draft. Review and publish to activate it. Up to 100 recent versions shown.","恢复会将历史内容载入新草稿，审核发布后才生效。最多显示最近 100 个版本。")}</p>
    {versions.map(v=><div key={v.version} className="editor-toolbar"><span>v{v.version} · {new Date(v.published_at).toLocaleString(language)}</span><button type="button" onClick={()=>load(draft.id,v.version)}>{say("Restore as new draft","恢复为新草稿")}</button></div>)}
    {!versions.length&&<p>{say("Not published yet.","尚未发布。")}</p>}
   </>}
  </fieldset>}
 </section>;
}

