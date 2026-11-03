"use client";
import {useEffect,useRef,useState} from "react";

export default function KnowledgeConnector({api,profiles,language,onImport}){
 const say=(en,zh)=>language==="zh"?zh:en;
 const [link,setLink]=useState(""),[connected,setConnected]=useState(false),[files,setFiles]=useState([]),[path,setPath]=useState("");
 const [sourceId,setSourceId]=useState(""),[preview,setPreview]=useState(null),[replace,setReplace]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
 const active=useRef(true),locked=useRef(false);
 useEffect(()=>{active.current=true;return()=>{active.current=false;};},[]);
 async function run(action){
  if(locked.current)return;locked.current=true;setBusy(true);setMessage("");
  try{await action();}catch(error){if(active.current)setMessage(error.message);}
  finally{locked.current=false;if(active.current)setBusy(false);}
 }
 async function connect(){
  await run(async()=>{
   const project=link.trim()||(await api("/api/admin/knowledge")).projectUrl;
   const value=await api("/api/admin/knowledge","POST",{action:"connect",link:project});
   if(!active.current)return;
   setLink(project);setConnected(true);setFiles(value.files);setPath(value.directPath||"");setPreview(null);
   setMessage(say("Connected. Select a published collection or preview a knowledge file below.","已连接。请选择已发布知识集或预览下方知识文件。"));
  });
 }
 async function inspect(action,extra){
  setPreview(null);setReplace(false);
  await run(async()=>{const value=await api("/api/admin/knowledge","POST",{action,link,...extra});if(active.current)setPreview(value);});
 }
 async function upload(event){
  const file=event.target.files?.[0];event.target.value="";if(!file)return;
  await run(async()=>{
   if(file.size>1000000)throw Error(say("Use a file smaller than 1 MB in this editor.","编辑器仅接受小于 1 MB 的文件。"));
   const value=await api("/api/admin/knowledge","POST",{action:"upload",link,path:file.name,content:await file.text()});
   if(!active.current)return;setPath(value.path);setPreview(null);setMessage(say("Uploaded to the private bucket. Preview this path before adding it to your draft: ","已上传至私有存储桶。请预览此路径后加入草稿：")+value.path);
  });
 }
 return <div className="knowledge-connector" aria-busy={busy}>
  <div className="source-intro"><div><p className="section-kicker">SUPABASE</p><h3>{say("Connect your museum knowledge","连接场馆知识库")}</h3><p>{say("Use this app’s existing Supabase connection. No additional API key is needed.","使用本应用已配置的 Supabase 连接，无需额外 API 密钥。")}</p></div><span className="source-status">{connected?say("Connected","已连接"):say("Ready to connect","待连接")}</span></div>
  <fieldset disabled={busy} className="editor-fieldset">
   <label>{say("Project URL or knowledge-file link (optional)","项目网址或知识文件链接（可选）")}<input type="url" value={link} placeholder="https://your-project.supabase.co" onChange={e=>{setLink(e.target.value);setConnected(false);setPreview(null);setFiles([]);}}/></label>
   <p className="admin-smallprint">{say("Leave empty to use the current project. Only its tourmate-knowledge bucket is accessible. Do not paste passwords, API keys or signed links.","留空可使用当前项目，仅可访问其中的 tourmate-knowledge 存储桶。请勿粘贴密码、API 密钥或签名链接。")}</p>
   <button type="button" className="primary-button" onClick={connect}>{busy?say("Working…","处理中…"):connected?say("Refresh connection & files","刷新连接与文件"):say("Connect current Supabase","连接当前 Supabase")}</button>
   {connected&&<div className="source-options">
    <section className="source-option"><span className="source-number">01</span><h3>{say("Published database records","已发布的数据库记录")}</h3><p>{say("Copy a museum’s published knowledge into this draft. Its persona is not imported.","将已发布场馆知识复制至当前草稿，不会导入其角色设定。")}</p>
     <label>{say("Knowledge collection","知识集")}<select value={sourceId} onChange={e=>{setSourceId(e.target.value);setPreview(null);}}><option value="">{say("Choose a museum…","选择场馆…")}</option>{profiles.filter(p=>p.id!=="tourmate").map(p=><option key={p.id} value={p.id}>{p.name[language]} · v{p.version}</option>)}</select></label>
     <button type="button" disabled={!sourceId} onClick={()=>inspect("database",{personaId:sourceId})}>{say("Preview collection","预览知识集")}</button>
    </section>
    <section className="source-option"><span className="source-number">02</span><h3>{say("Knowledge files","知识文件")}</h3><p>{say("Private bucket: tourmate-knowledge. JSON, TXT and Markdown supported.","私有存储桶：tourmate-knowledge，支持 JSON、TXT 和 Markdown。")}</p>
     <label>{say("Select a file","选择文件")}<select value={files.some(f=>f.name===path)?path:""} onChange={e=>{setPath(e.target.value);setPreview(null);}}><option value="">{say("Choose a file…","选择文件…")}</option>{files.map(f=><option key={f.name} value={f.name}>{f.name}</option>)}</select></label>
     <label>{say("Or enter a file path","或输入文件路径")}<input value={path} placeholder="museum-guide.json" onChange={e=>{setPath(e.target.value);setPreview(null);}}/></label>
     <button type="button" disabled={!path} onClick={()=>inspect("preview",{path})}>{say("Preview file","预览文件")}</button>
     <label className="source-upload">{say("Upload a new file (maximum 1 MB)","上传新文件（最大 1 MB）")}<input type="file" accept=".json,.txt,.md,application/json,text/plain,text/markdown" onChange={upload}/></label>
     <small>{say("Lists supported files among the first 100 root entries. For subfolders, enter the full path. Uploads never overwrite existing files.","列表显示根目录前 100 项中的支持文件。子目录请填写完整路径。上传不会覆盖已有文件。")}</small>
    </section>
   </div>}
   {preview&&<section className="source-preview"><h3>{say("Import preview","导入预览")} · {preview.knowledge.length} {say("records","条记录")}</h3><p>{preview.source.name}{preview.source.version?" · v"+preview.source.version:""}</p>
    <div className="editor-review">{preview.knowledge.slice(0,50).map(r=><details key={r.id}><summary>{r.id} · {r["question_"+language]}</summary><p>{r["answer_"+language]}</p></details>)}</div>
    {preview.knowledge.length>50&&<p>{say("First 50 records shown here. Review every imported record in the editor before publishing.","此处仅展示前 50 条，发布前请在编辑器中审核全部导入记录。")}</p>}
    <p>{say("Text excerpts keep their original language; they are not automatically translated. Check titles, both languages, facts and source permissions.","文本片段保留原文，不会自动翻译。请核对标题、双语内容、事实及来源使用权限。")}</p>
    <label className="admin-confirm"><input type="checkbox" checked={replace} onChange={e=>setReplace(e.target.checked)}/>{say("Replace ALL knowledge in this draft. Otherwise merge by record ID (matching IDs are updated).","替换当前草稿中的全部知识。默认按记录 ID 合并，相同 ID 的记录会被更新。")}</label>
    <button type="button" className="primary-button" onClick={()=>run(async()=>{onImport(preview.knowledge,replace);setPreview(null);setMessage(say("Added to the draft. Open Knowledge to edit, then Review & publish to activate.","已加入草稿。请前往知识栏目编辑，再审核发布使其生效。"));})}>{say("Add to draft","加入草稿")}</button>
   </section>}
  </fieldset>
  {message&&<p className="notice" role="status">{message}</p>}
  <p className="admin-smallprint">{say("Import → edit → review → publish. This creates a versioned snapshot, not a live database query. When source content changes, refresh, import and publish again. No visitor conversations or unrelated tables are read.","导入 → 编辑 → 审核 → 发布。此流程生成版本化快照，并非实时数据库查询。源内容变化后，请刷新、重新导入并发布。不会读取访客对话或无关数据表。")}</p>
 </div>;
}
