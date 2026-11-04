"use client";
import {useEffect,useState} from 'react';
const colors=['#245bd8','#5b83e5','#839fe9','#acc0f0','#cfdbf7','#e5eaf4'];
export function csvField(value){const text=String(value??'');return '"'+(/^[\s]*[=+@-]/.test(text)?"'":"")+text.replaceAll('"','""')+'"';}
function today(){return new Date(Date.now()+8*3600000).toISOString().slice(0,10);}
function initialFrom(){return new Date(Date.parse(today()+'T00:00:00Z')-6*86400000).toISOString().slice(0,10);}
export default function AdminDashboard({profiles,client,language}){
 const zh=language==='zh',say=(en,cn)=>zh?cn:en;
 const museums=profiles.filter(p=>p.id!=='tourmate');
 const [museum,setMuseum]=useState(()=>museums[0]?.id||''),[from,setFrom]=useState(initialFrom),[to,setTo]=useState(today),[traffic,setTraffic]=useState('visitor');
 const [attempt,setAttempt]=useState(0),[data,setData]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{
  if(!museum)return;let active=true;const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),60000);setBusy(true);setData(null);setError('');
  (async()=>{const {data:session}=await client.auth.getSession();if(!session.session?.access_token)throw Error('Please sign in again.');
   const q=new URLSearchParams({personaId:museum,from,to,traffic});
   const response=await fetch('/api/admin/analytics?'+q,{headers:{Authorization:'Bearer '+session.session.access_token},cache:'no-store',signal:controller.signal});
   const payload=await response.json();if(!response.ok)throw Error(payload.error?.message||'Dashboard unavailable');if(active)setData(payload);
  })().catch(e=>{if(active)setError(e.name==='AbortError'?'The dashboard timed out. Choose a shorter range and retry.':e.message);}).finally(()=>{clearTimeout(timer);if(active)setBusy(false);});
  return()=>{active=false;controller.abort();clearTimeout(timer);};
 },[museum,from,to,traffic,attempt,client]);
 const classified=data?.artifacts.reduce((n,r)=>n+r.count,0)||0;
 const slices=data?.artifacts.slice(0,5)||[];const other=classified-slices.reduce((n,r)=>n+r.count,0);if(other)slices.push({id:'other',en:'Other',zh:'其他',count:other});
 let position=0;const gradient=slices.map((row,i)=>{const start=position;position+=row.count/classified*100;return colors[i]+' '+start+'% '+position+'%';}).join(',');
 const imageLabels={matched:say('Catalogue match','匹配馆藏记录'),not_found:say('No catalogue match','未找到馆藏记录'),uncertain:say('Uncertain / more detail','不确定／需更多细节'),unavailable:say('Service unavailable','服务不可用'),rejected:say('Rejected by scope / safety','范围或安全规则拒绝')};
 const maxDaily=Math.max(1,...(data?.days.map(d=>d.count)||[]));
 function exportCSV(){const rows=[['section','id/date','label','count'],...data.artifacts.map(r=>['artifact',r.id,r[language],r.count]),...data.days.map(r=>['daily',r.date,'',r.count]),...Object.entries(data.images).map(([id,count])=>['image',id,imageLabels[id],count]),['coverage','','recorded',data.total],['coverage','','stored requests',data.expected]];
  const url=URL.createObjectURL(new Blob(['\ufeff'+rows.map(r=>r.map(csvField).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='tourmate-'+museum+'-'+from+'-'+to+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 return <section className="dashboard" aria-label={say('Museum analytics dashboard','场馆数据看板')} aria-busy={busy}>
  <div className="dashboard-heading"><div><p className="section-kicker">TOURMATE INSIGHTS</p><h2>{say('Understand your visitors','了解访客的关注点')}</h2><p>{say('Artifact interest, activity and questions that need attention.','查看文物关注度、咨询趋势与需要跟进的问题。')}</p></div><button type="button" onClick={()=>setAttempt(n=>n+1)} disabled={busy}>{say('Refresh data','刷新数据')}</button></div>
  <div className="dashboard-filters">
   <label>{say('Museum','场馆')}<select value={museum} onChange={e=>setMuseum(e.target.value)}>{museums.map(p=><option key={p.id} value={p.id}>{p.name[language]}</option>)}</select></label>
   <label>{say('From','开始日期')}<input type="date" value={from} max={to} onChange={e=>setFrom(e.target.value)}/></label>
   <label>{say('To','结束日期')}<input type="date" value={to} min={from} max={today()} onChange={e=>setTo(e.target.value)}/></label>
   <label>{say('Traffic','数据来源')}<select value={traffic} onChange={e=>setTraffic(e.target.value)}><option value="visitor">{say('Visitors','访客')}</option><option value="test">{say('Administrator tests','管理员测试')}</option></select></label>
  </div>
  <p className="admin-smallprint">{say('Dates use China time (UTC+8). Up to 31 days per view. Each stored user message counts once; follow-up questions count separately. Administrator-account requests are shown separately as tests.','日期采用中国时间（UTC+8），每次最多查询 31 天。每条已保存的用户消息计为一次，追问单独计数。管理员账号的请求单列为测试数据。')}</p>
  {!museum&&<p className="notice">{say('Publish a museum profile to begin.','请先发布场馆角色。')}</p>}
  {busy&&<p role="status" className="dashboard-state">{say('Verifying recorded data…','正在核对记录数据…')}</p>}
  {error&&<div role="alert" className="notice"><strong>{say('Data unavailable.','数据暂不可用。')}</strong> {error} <button type="button" onClick={()=>setAttempt(n=>n+1)}>{say('Retry','重试')}</button></div>}
  {data&&<>
   <div className={'dashboard-coverage '+(!data.coverageComplete?'is-partial':'')} role="status">
    <strong>{data.coverageComplete?say('History cross-check passed','已通过历史记录核对'):say('Incomplete tracking — investigate before reporting','记录不完整，请先核查再引用统计')}</strong>
    <span>{data.total} / {data.expected} {say('stored requests have analytics records.','条已保存请求具有分析记录。')} {say('Collection began: ','开始采集：')}{new Date(data.startedAt).toLocaleString(zh?'zh-CN':'en-GB',{timeZone:'Asia/Shanghai'})}</span>
   </div>
   {!data.total&&<p className="dashboard-state">{say('No recorded activity for this selection. Historical artifact statistics were not inferred. Try Administrator tests after submitting a new museum question with your admin account.','当前筛选没有记录，系统不会推测历史文物统计。使用管理员账号提交新的场馆问题后，可切换到管理员测试查看。')}</p>}
   <div className="dashboard-stats">{[[say('Recorded enquiries','已记录咨询'),data.total],[say('Classified artifact enquiries','已分类文物咨询'),classified],[say('Needs follow-up','需跟进'),data.unresolvedCount],[say('Image requests','图片请求'),Object.values(data.images).reduce((a,b)=>a+b,0)]].map(([label,value])=><div key={label}><span>{label}</span><strong>{value.toLocaleString()}</strong></div>)}</div>
   <div className="dashboard-grid">
    <section className="admin-card"><h3>{say('Most-discussed artifacts','最常被询问的文物')}</h3><p>{say('Share of classified artifact enquiries · top five + other','已分类文物咨询的占比 · 前五项及其他')}</p>
     {classified?<div className="dashboard-pie-row"><div className="dashboard-pie" role="img" aria-label={say('Artifact enquiry shares; exact counts appear in the table.','文物咨询占比，具体计数见表格。')} style={{background:'conic-gradient('+gradient+')'}}><span>{classified}<small>{say('enquiries','次咨询')}</small></span></div><table><caption className="sr-only">{say('Artifact shares','文物占比')}</caption><thead><tr><th>{say('Artifact','文物')}</th><th>{say('Count','次数')}</th><th>%</th></tr></thead><tbody>{slices.map((r,i)=><tr key={r.id}><td><i style={{background:colors[i]}}/>{r[language]}</td><td>{r.count}</td><td>{(r.count/classified*100).toFixed(1)}%</td></tr>)}</tbody></table></div>:<p className="dashboard-state">{say('No confidently classified artifact enquiries yet.','暂无可明确分类的文物咨询。')}</p>}
     <p className="admin-smallprint">{data.unclassified} {say('requests unclassified / not artifact-specific. Retrieved citations alone never count as visitor interest.','条请求未分类或并非针对具体文物。仅检索到引用资料不会被计为文物关注度。')}</p>
    </section>
    <section className="admin-card"><h3>{say('Enquiry trends','咨询趋势')}</h3><p>{say('Recorded requests by day · China time','每日已记录请求 · 中国时间')}</p>
     <div className="dashboard-trend" role="img" aria-label={say('Daily request trend; exact values available below.','每日咨询趋势，具体数值见下方。')}><svg viewBox="0 0 620 180" preserveAspectRatio="none"><line x1="12" y1="165" x2="608" y2="165" stroke="#dce5f4"/><polyline fill="none" stroke="#245bd8" strokeWidth="3" points={data.days.flatMap((d,i)=>d.count===null?[]:[(12+i*596/Math.max(1,data.days.length-1))+','+(165-d.count/maxDaily*145)]).join(' ')}/>{data.days.map((d,i)=>d.count===null?null:<circle key={d.date} cx={12+i*596/Math.max(1,data.days.length-1)} cy={165-d.count/maxDaily*145} r="4" fill="#245bd8"><title>{d.date+': '+d.count}</title></circle>)}</svg></div>
     <details><summary>{say('View daily counts','查看每日计数')}</summary><table><thead><tr><th>{say('Date','日期')}</th><th>{say('Requests','请求数')}</th></tr></thead><tbody>{data.days.map(d=><tr key={d.date}><td>{d.date}</td><td>{d.count??"—"}</td></tr>)}</tbody></table></details>
    </section>
    <section className="admin-card"><h3>{say('Image-identification outcomes','图片识别结果')}</h3><p>{say('Operational outcomes, not a measured accuracy score. A catalogue match still requires curator validation.','此为处理结果，并非准确率评估。匹配馆藏记录仍需策展人员核验。')}</p>
     {Object.entries(data.images).map(([key,count])=><div className="dashboard-image-row" key={key}><span>{imageLabels[key]}</span><strong>{count}</strong><progress aria-label={imageLabels[key]} max={Math.max(1,Object.values(data.images).reduce((a,b)=>a+b,0))} value={count}/></div>)}
    </section>
    <section className="admin-card"><h3>{say('Questions needing follow-up','需要跟进的问题')}</h3><p>{say('Clarifications, unmatched items and unavailable services. Redacted excerpts from surviving chat history; latest 100 shown.','包含需澄清、未匹配及服务不可用的请求。展示尚存聊天记录的脱敏摘要，最多显示最近 100 条。')}</p>
     {data.unresolved.length?<div className="dashboard-questions">{data.unresolved.map(r=><details key={r.id}><summary>{r.question}</summary><p>{new Date(r.at).toLocaleString(zh?'zh-CN':'en-GB',{timeZone:'Asia/Shanghai'})} · {r.inputType==='image'?say('Image','图片'):r.inputType==='document'?say('Document','文档'):say('Text','文字')} · {r.outcome==='unavailable'?say('Service unavailable','服务不可用'):say('More detail / knowledge needed','需更多细节或资料')}</p></details>)}</div>:<p className="dashboard-state">{say('No follow-up requests recorded for this selection.','当前筛选暂无需跟进的请求。')}</p>}
    </section>
   </div>
   <div className="dashboard-footer"><small>{say('Data checked at ','核对时间：')}{new Date(data.asOf).toLocaleString(zh?'zh-CN':'en-GB',{timeZone:'Asia/Shanghai'})} · {say('Completed, saved exchanges only; pre-authentication and unpersisted failures are excluded.','仅统计已完成并保存的对话请求，不含认证前或未保存的失败请求。')}</small><button type="button" onClick={exportCSV}>{say('Export chart data (CSV)','导出图表数据（CSV）')}</button></div>
  </>}
 </section>;
}

