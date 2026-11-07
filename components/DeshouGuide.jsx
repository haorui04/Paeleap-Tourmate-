'use client';

import { useEffect, useRef, useState } from 'react';
import { exhibitLink, GUIDE_ORIGIN, reportLabels, reportReasons, speechPages, tours } from '../lib/museum-guide.js';

const groups = {
  all: { en: 'All exhibits', zh: '全部展品' },
  architecture: { en: 'Architecture & ruins', zh: '建筑与遗址' },
  ceramics: { en: 'Ceramics', zh: '瓷器' },
  daily: { en: 'Daily life', zh: '宋人生活' }
};
const zones = [
  { en: 'Chonghua Palace', zh: '重华宫', detail: { en: 'Explore the reconstructed hall and archaeological remains.', zh: '了解正殿复原陈设与考古遗存。' }, id: 'DS004' },
  { en: 'Cifu Palace & gardens', zh: '慈福宫与苑囿', detail: { en: 'Discover the garden and Little West Lake interpretation.', zh: '探索苑囿遗址与小西湖数字解读。' }, id: 'DS019' },
  { en: 'Southern Song Lin’an', zh: '南宋临安', detail: { en: 'Look at ceramics and objects from Song daily life.', zh: '通过瓷器与日常器物了解宋人生活。' }, id: 'DS010' }
];
const observations = {
  DS005: { en: ['How many flower tubes can you count?', 'Look for seven hollow supports.'], zh: ['你能数出几根花管？', '观察七根空心花管。'] },
  DS014: { en: ['Where would this tile belong on a building?', 'Look toward the roof edge.'], zh: ['瓦当原本在建筑的哪个位置？', '看看屋檐的边缘。'] },
  DS011: { en: ['Which animal motif can you spot?', 'Look for the bird decoration.'], zh: ['你能发现哪种动物纹饰？', '留意禽鸟纹饰。'] }
};

function Rabbit({ small = false }) {
  return <svg className={small ? 'deshou-rabbit small' : 'deshou-rabbit'} viewBox="0 0 120 132" aria-hidden="true">
    <ellipse cx="60" cy="121" rx="35" ry="6" fill="#342b25" opacity=".14" />
    <path d="M35 112c0-26 8-39 25-39s26 13 26 39c-9 9-42 9-51 0" fill="#984539" />
    <path d="M47 91l14 14 16-15M61 105v12" fill="none" stroke="#f0c183" strokeWidth="3" />
    <g className="deshou-ears"><path d="M40 48C23 17 33 1 44 11c9 9 11 24 12 36M65 46C62 18 74 1 84 10c9 9 2 27-3 41" fill="#fff7e5" stroke="#594138" strokeWidth="2.5"/><path d="M44 40c-9-15-10-24-5-23 5 2 8 12 10 23M71 41c0-13 4-24 9-25 5-1 0 14-4 26" fill="#e9aa96"/></g>
    <ellipse cx="60" cy="65" rx="34" ry="28" fill="#fff7e5" stroke="#594138" strokeWidth="2.5" />
    <path d="M29 58h61l-9-11H40Z" fill="#607669"/><circle cx="60" cy="48" r="5" fill="#dbad6b"/>
    <g className="deshou-eyes" fill="#3a2824"><ellipse cx="47" cy="67" rx="3.2" ry="4.5"/><ellipse cx="73" cy="67" rx="3.2" ry="4.5"/></g>
    <ellipse cx="37" cy="75" rx="5" ry="2.6" fill="#edb69e"/><ellipse cx="83" cy="75" rx="5" ry="2.6" fill="#edb69e"/>
    <path d="M56 74q4-4 8 0l-4 3zm4 3q-3 7-8 2m8-2q3 7 8 2" fill="none" stroke="#633b35" strokeWidth="2" strokeLinecap="round"/>
  </svg>;
}

function PalaceDrawing({ ruins = false }) {
  return <svg viewBox="0 0 450 180" className="deshou-palace" aria-hidden="true">
    <circle cx="339" cy="51" r="29" fill="#edd4a6" />
    <path d="M0 122L88 63l45 42 46-25 54 45 86-65 131 68v52H0Z" fill="#839487" opacity=".25" />
    <path d="M0 148h450v32H0z" fill="#c9a381" opacity=".45" />
    {ruins ? <g fill="#af8869" stroke="#785d4b" strokeWidth="2"><path d="M68 143l60-32 193 2 59 33-53 17-211-4Z"/><path d="m154 126 126 1 34 15-150 1Z" fill="#dfc2a1"/><path d="M112 150h240M192 121v25m53-24v23"/><circle cx="147" cy="133" r="7"/><circle cx="293" cy="133" r="7"/></g> :
      <g><path d="M91 150h270l-17-12H108Z" fill="#b99b79"/><path d="M116 91h221v49H116Z" fill="#a44b3c"/><path d="M148 93v46m39-46v46m39-46v46m39-46v46m39-46v46" stroke="#e9b58a" strokeWidth="5"/><path d="M71 98c58-5 105-24 154-66 52 43 97 61 154 66-51 8-259 8-308 0Z" fill="#4c5c50"/><path d="M90 102h270" stroke="#6c392d" strokeWidth="5"/><path d="M132 91q49-13 93-56m94 56q-49-13-94-56" stroke="#adb498" fill="none" strokeWidth="2"/></g>}
  </svg>;
}

function Sources({ record, label }) {
  return <details className="deshou-sources"><summary>{label}</summary><ul>{record.sources.map(source => <li key={source.url}><a href={source.url} target="_blank" rel="noreferrer">{source.name}</a></li>)}</ul></details>;
}

export default function DeshouGuide({ language, onAsk, onPhoto, onReport, onBrowse, active }) {
  const say = (en, zh) => language === 'zh' ? zh : en;
  const [view, setView] = useState('home');
  const [records, setRecords] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [group, setGroup] = useState('all');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(null);
  const [saved, setSaved] = useState([]);
  const [progress, setProgress] = useState(null);
  const [hydrated, setHydrated] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [comparison, setComparison] = useState('');
  const [thenNow, setThenNow] = useState(null);
  const [qr, setQr] = useState(false);
  const [observed, setObserved] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [rate, setRate] = useState(1);
  const [audioMessage, setAudioMessage] = useState('');
  const utterance = useRef(null);
  const heading = useRef(null);
  const reportSequence = useRef(0);
  const [reason, setReason] = useState('');
  const [reportState, setReportState] = useState('');
  const [returnView, setReturnView] = useState('gallery');

  useEffect(() => {
    const id = new URLSearchParams(location.search).get('artifact');
    if (id && /^DS\d{3}$/.test(id)) { setSelected(id); setView('artifact'); }
    try {
      const stored = JSON.parse(localStorage.getItem('deshou-guide-v1') || '{}');
      if (Array.isArray(stored.saved)) setSaved(stored.saved.filter(id => typeof id === 'string' && /^DS\d{3}$/.test(id)).slice(0, 30));
      if (tours.some(tour => tour.id === stored.progress?.tour) && Number.isSafeInteger(stored.progress.stop) && Number.isSafeInteger(stored.progress.page)) setProgress(stored.progress);
    } catch { /* Browsing is available when storage is disabled. */ }
    setHydrated(true);
  }, []);
  useEffect(() => {
    if (!hydrated) return;
    try { localStorage.setItem('deshou-guide-v1', JSON.stringify({ saved, progress })); } catch { /* Optional device storage. */ }
  }, [saved, progress, hydrated]);
  useEffect(() => {
    const controller = new AbortController();
    setLoadError(false);
    fetch('/api/museum', { signal: controller.signal }).then(response => {
      if (!response.ok) throw Error('Museum catalogue unavailable');
      return response.json();
    }).then(data => setRecords(data.records)).catch(() => { if (!controller.signal.aborted) setLoadError(true); });
    return () => controller.abort();
  }, [retry]);
  useEffect(() => {
    utterance.current = null;
    window.speechSynthesis?.cancel();
    setSpeaking(false);
    setAudioMessage('');
  }, [view, selected, progress, language, active]);
  useEffect(() => () => {
    if (utterance.current) window.speechSynthesis?.cancel();
  }, []);

  const catalogue = records || [];
  const record = catalogue.find(item => item.id === selected);
  const tour = tours.find(item => item.id === progress?.tour);
  const stops = tour?.ids.map(id => catalogue.find(item => item.id === id)).filter(Boolean) || [];
  const index = Math.max(0, Math.min(progress?.stop ?? 0, stops.length - 1));
  const current = stops[index];
  const pages = current ? speechPages(current.description[language]) : [];
  const page = Math.max(0, Math.min(progress?.page ?? 0, pages.length - 1));

  function open(next) {
    onBrowse();
    setView(next);
    requestAnimationFrame(() => {
      heading.current?.closest('.deshou-explorer')?.scrollTo(0, 0);
      heading.current?.focus({ preventScroll: true });
    });
  }
  function showArtifact(id, back = 'gallery') {
    reportSequence.current += 1;
    setSelected(id); setExpanded(false); setComparison(''); setThenNow(null); setQr(false); setReason(''); setReportState('');
    setReturnView(back); open('artifact');
  }
  function save(id) {
    setSaved(items => items.includes(id) ? items.filter(item => item !== id) : [...items, id]);
  }
  function speak(text) {
    if (!window.speechSynthesis || typeof SpeechSynthesisUtterance === 'undefined') {
      setAudioMessage(say('Audio is unavailable on this device. Read the transcript below.', '此设备暂不支持朗读，请阅读下方文字。')); return;
    }
    utterance.current = null;
    window.speechSynthesis.cancel();
    if (speaking) { setSpeaking(false); return; }
    const speech = new SpeechSynthesisUtterance(text);
    utterance.current = speech;
    speech.lang = language === 'zh' ? 'zh-CN' : 'en';
    speech.rate = rate;
    speech.onend = () => { if (utterance.current === speech) setSpeaking(false); };
    speech.onerror = () => { if (utterance.current === speech) { setSpeaking(false); setAudioMessage(say('Audio could not play. The transcript is available below.', '无法播放语音，可阅读下方文字。')); } };
    setAudioMessage(''); setSpeaking(true); window.speechSynthesis.speak(speech);
  }
  const audioRate = <label className="deshou-audio-rate">{say('Audio speed', '朗读速度')} <select value={rate} onChange={event => setRate(Number(event.target.value))}>
    <option value={0.8}>{say('Slow', '慢速')}</option><option value={1}>{say('Normal', '正常')}</option><option value={1.2}>{say('Fast', '快速')}</option>
  </select></label>;
  function advance(skip = false) {
    if (!current) return;
    if (!skip && page < pages.length - 1) { setProgress({ ...progress, page: page + 1 }); return; }
    setObserved(false);
    if (index < stops.length - 1) setProgress({ ...progress, stop: index + 1, page: 0 });
    else { setProgress(null); open('complete'); }
  }
  function askAbout(item, prompt = item.question[language]) { onAsk(item, prompt); }
  async function report() {
    if (!record || !reason || reportState === 'sending') return;
    const sequence = ++reportSequence.current;
    setReportState('sending');
    try { await onReport(record.id, reason); if (sequence === reportSequence.current) setReportState('sent'); }
    catch { if (sequence === reportSequence.current) setReportState('error'); }
  }
  const filtered = catalogue.filter(item => (group === 'all' || group === item.group) && `${item.name.en} ${item.name.zh} ${item.id}`.toLowerCase().includes(query.trim().toLowerCase()));
  const cards = (items, back) => <div className="deshou-grid">{items.map(item => <button className="deshou-exhibit" key={item.id} type="button" onClick={() => showArtifact(item.id, back)}>
    {item.id === 'DS005' ? <img src="/artifacts/deshou/seven-tube-vessel.jpg" alt="" loading="lazy" /> : <span className="deshou-category-mark" aria-hidden="true">{{ architecture: '瓦', ceramics: '瓷', daily: '雅' }[item.group]}</span>}
    <span><small>{groups[item.group][language]}</small><strong>{item.name[language]}</strong></span><span aria-hidden="true">↗</span>
  </button>)}</div>;
  const loading = !records && !loadError;

  return <div className="deshou-guide">
    <nav className="deshou-nav" aria-label={say('Museum guide', '博物馆导览')}>
      <button type="button" aria-current={active && ['home','gallery','artifact','visit'].includes(view) ? 'page' : undefined} onClick={() => open('home')}>{say('Explore', '探索')}</button>
      <button type="button" aria-current={active && ['tours','tour','complete'].includes(view) ? 'page' : undefined} onClick={() => open('tours')}>{say('Tour', '导览')}</button>
      <button type="button" aria-current={!active ? 'page' : undefined} onClick={() => { if (active) onAsk(); }}>{say('Ask', '提问')}</button>
      <button type="button" aria-current={active && view === 'saved' ? 'page' : undefined} onClick={() => open('saved')}>{say('Saved', '收藏')}{saved.length ? ` · ${saved.length}` : ''}</button>
    </nav>
    <div key={view} className="deshou-view" hidden={!active}>
      {view === 'home' && <>
        <header className="deshou-hero" onPointerMove={event => {
          if (event.pointerType !== 'mouse' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
          const bounds = event.currentTarget.getBoundingClientRect();
          event.currentTarget.style.setProperty('--scene-x', ((event.clientX - bounds.left) / bounds.width - .5) * 12 + 'deg');
          event.currentTarget.style.setProperty('--scene-y', ((event.clientY - bounds.top) / bounds.height - .5) * -8 + 'deg');
        }} onPointerLeave={event => {
          event.currentTarget.style.setProperty('--scene-x', '0deg');
          event.currentTarget.style.setProperty('--scene-y', '0deg');
        }}>
          <div><p className="deshou-kicker">{say('SOUTHERN SONG · HANGZHOU', '南宋 · 杭州')}</p><h1 ref={heading} tabIndex={-1}>{say('Walk through Deshou Palace', '漫游德寿宫')}</h1><p>{say('Explore the Southern Song Deshou Palace Ruins with Little De Rabbit.', '与小德兔一起探索南宋德寿宫遗址。')}</p></div>
          <div className="deshou-scene"><div className="deshou-orbit" aria-hidden="true"/><div className="deshou-platform" aria-hidden="true"/><PalaceDrawing/><span className="deshou-lantern first" aria-hidden="true"/><span className="deshou-lantern second" aria-hidden="true"/><span className="deshou-scene-caption">{say('DESHOU PALACE · A JOURNEY THROUGH TIME', '德寿宫 · 与时光相遇')}</span></div>
        </header>
        <div className="deshou-actions">
          <button className="deshou-primary" type="button" onClick={() => open('tours')}>{say('Start guided tour', '开始导览')}</button>
          <button type="button" onClick={() => open('gallery')}>{say('Browse artifacts', '探索文物')}</button>
          <button type="button" onClick={onPhoto}>{say('Identify a photo', '拍照识物')}</button>
          <button type="button" onClick={() => open('visit')}>{say('Visit information', '参观信息')}</button>
        </div>
        <h2>{say('Explore the exhibition areas', '探索展区')}</h2>
        <div className="deshou-grid zones">{zones.map(zone => <button key={zone.id} type="button" onClick={() => showArtifact(zone.id, 'home')}><strong>{zone[language]}</strong><span>{zone.detail[language]}</span></button>)}</div>
      </>}
      {loadError && <p role="alert" className="deshou-notice">{say('The exhibit catalogue is temporarily unavailable.', '文物资料暂不可用。')} <button type="button" onClick={() => setRetry(value => value + 1)}>{say('Retry', '重试')}</button></p>}
      {loading && <p role="status">{say('Loading exhibits…', '正在载入文物…')}</p>}
      {view === 'gallery' && <><h1 ref={heading} tabIndex={-1}>{say('Browse artifacts', '探索文物')}</h1>
        <label className="deshou-search">{say('Search exhibits', '搜索展品')}<input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder={say('Name or exhibit ID', '名称或展品编号')}/></label>
        <div className="deshou-actions">{Object.entries(groups).map(([id,label]) => <button key={id} type="button" aria-pressed={group === id} onClick={() => setGroup(id)}>{label[language]}</button>)}</div>
        {cards(filtered, 'gallery')}{records && !filtered.length && <p>{say('No exhibits match your search.', '未找到匹配展品。')}</p>}
      </>}
      {view === 'saved' && <><h1 ref={heading} tabIndex={-1}>{say('Saved exhibits', '收藏的展品')}</h1><p>{say('Bookmarks are stored in this browser.', '收藏保存在当前浏览器。')}</p>{cards(catalogue.filter(item => saved.includes(item.id)), 'saved')}{records && !catalogue.some(item => saved.includes(item.id)) && <p>{say('Save an exhibit to revisit it here.', '收藏展品后可在此查看。')}</p>}</>}
      {view === 'artifact' && <>
        <button type="button" onClick={() => open(returnView)}>{say('← Back', '← 返回')}</button>
        {records && !record && <p>{say('This exhibit record is currently unavailable.', '此展品资料目前不可用。')}</p>}
        {record && <article className="deshou-object">
          <p className="deshou-kicker">{groups[record.group][language]} · {record.id}</p>
          <h1 ref={heading} tabIndex={-1}>{record.name[language]}</h1>
          {record.id === 'DS005' && <figure><img src="/artifacts/deshou/seven-tube-vessel.jpg" alt={record.name[language]}/><figcaption><a href="/artifacts/deshou/ATTRIBUTION.txt">Siyuwj · Wikimedia Commons · CC BY-SA 4.0</a></figcaption></figure>}
          <div className="deshou-reading"><p>{expanded ? record.description[language] : speechPages(record.description[language])[0]}</p>
            <div className="deshou-actions"><button type="button" aria-pressed={expanded} onClick={() => setExpanded(!expanded)}>{expanded ? say('Short summary', '简短说明') : say('Read more', '阅读详情')}</button><button type="button" onClick={() => speak(expanded ? record.description[language] : speechPages(record.description[language])[0])}>{speaking ? say('Stop audio', '停止朗读') : say('Listen', '听讲解')}</button><button type="button" aria-pressed={saved.includes(record.id)} onClick={() => save(record.id)}>{saved.includes(record.id) ? say('Saved', '已收藏') : say('Save exhibit', '收藏展品')}</button></div>
            {audioRate}{audioMessage && <p role="status">{audioMessage}</p>}
          </div>
          <div className="deshou-actions"><button className="deshou-primary" type="button" onClick={() => askAbout(record)}>{say('Ask about this exhibit', '询问这件展品')}</button><button type="button" onClick={() => askAbout(record, say(`What was the ${record.name.en} used for?`, `${record.name.zh}有什么用途？`))}>{say('What was it used for?', '它有什么用途？')}</button><button type="button" onClick={() => askAbout(record, say(`Explain the ${record.name.en} in simple terms.`, `请简单介绍${record.name.zh}。`))}>{say('Explain simply', '简单讲解')}</button></div>
          <Sources record={record} label={say('Sources and references', '资料来源')}/>
          {['DS004','DS017','DS019'].includes(record.id) && <div className="deshou-reading"><h2>{say('Then & Now', '昔日与今日')}</h2><div className="deshou-actions"><button type="button" aria-pressed={thenNow === 'then'} onClick={() => setThenNow('then')}>{say('Reconstruction', '复原示意')}</button><button type="button" aria-pressed={thenNow === 'now'} onClick={() => setThenNow('now')}>{say('Archaeological remains', '遗迹示意')}</button></div>{thenNow && <figure><PalaceDrawing ruins={thenNow === 'now'}/><figcaption>{say('Interpretive illustration. Read the published description above for the documented evidence.', '解读示意图。实际考古资料请参阅上方的展品说明。')}</figcaption></figure>}</div>}
          <label className="deshou-search">{say('Compare with another exhibit', '与另一展品对比')}<select value={comparison} onChange={event => setComparison(event.target.value)}><option value="">{say('Choose an exhibit', '选择展品')}</option>{catalogue.filter(item => item.id !== record.id).map(item => <option key={item.id} value={item.id}>{item.name[language]}</option>)}</select></label>
          {comparison && catalogue.filter(item => [record.id, comparison].includes(item.id)).length === 2 && <div className="deshou-grid">{[record, catalogue.find(item => item.id === comparison)].map(item => <section className="deshou-reading" key={item.id}><h3>{item.name[language]}</h3><p>{item.description[language]}</p><Sources record={item} label={say('Sources', '资料来源')}/></section>)}</div>}
          <details className="deshou-sources" onToggle={event => setQr(event.currentTarget.open)}><summary>{say('Share exhibit & QR code', '分享展品与二维码')}</summary><a href={exhibitLink(record.id)}>{say('Direct exhibit link', '展品直达链接')}</a>{qr && <figure><img className="deshou-qr" src={`/museum/qr/${record.id}.svg`} alt={say(`QR code for ${record.name.en}`, `${record.name.zh}二维码`)}/><figcaption><a href={GUIDE_ORIGIN + exhibitLink(record.id)}>{say('Open public exhibit page', '打开公开展品页面')}</a></figcaption></figure>}</details>
          <details className="deshou-sources"><summary>{say('Report an issue', '反馈问题')}</summary>{onReport ? <><label className="deshou-search">{say('Issue type', '问题类型')}<select value={reason} onChange={event => setReason(event.target.value)}><option value="">{say('Choose a reason', '请选择原因')}</option>{reportReasons.map(value => <option key={value} value={value}>{reportLabels[value][language]}</option>)}</select></label><button type="button" disabled={!reason || reportState === 'sending' || reportState === 'sent'} onClick={report}>{reportState === 'sending' ? say('Sending…', '发送中…') : say('Submit report', '提交反馈')}</button>{reportState === 'sent' && <p role="status">{say('Report received for this exhibit.', '已收到该展品的反馈。')}</p>}{reportState === 'error' && <p role="alert">{say('Could not send the report. Please retry.', '未能发送反馈，请重试。')}</p>}</> : <button type="button" onClick={() => onAsk()}>{say('Sign in to report', '登录后反馈')}</button>}</details>
        </article>}
      </>}
      {view === 'tours' && <><h1 ref={heading} tabIndex={-1}>{say('Guided tours', '主题导览')}</h1><p>{say('Choose a thematic sequence and follow the museum signs between exhibits.', '选择主题导览，实际参观请遵循场馆指示。')}</p>
        <div className="deshou-dialogue"><Rabbit/><div className="deshou-reading"><strong>{say('Little De Rabbit', '小德兔')}</strong><p>{say('Welcome to Deshou Palace. Pick a tour and I’ll introduce each exhibit along the way.', '欢迎来到德寿宫。选一条路线，我会陪你一站一站看展品。')}</p></div></div>
        {progress && stops.length > 0 && <button className="deshou-primary" type="button" onClick={() => open('tour')}>{say('Resume tour', '继续导览')} · {tour.name[language]}</button>}
        <div className="deshou-grid zones">{tours.map(item => <button type="button" key={item.id} disabled={!item.ids.some(id => catalogue.some(record => record.id === id))} onClick={() => { setObserved(false); setProgress({ tour: item.id, stop: 0, page: 0 }); open('tour'); }}><strong>{item.name[language]}</strong><span>{item.ids.filter(id => catalogue.some(record => record.id === id)).length} {say('stops', '站')}</span></button>)}</div>
      </>}
      {view === 'tour' && current && <article className="deshou-tour"><p className="deshou-kicker">{tour.name[language]} · {say('Stop', '站点')} {index + 1}/{stops.length}</p><h1 ref={heading} tabIndex={-1}>{current.name[language]}</h1>
        <progress value={index + 1} max={stops.length} aria-label={say('Tour progress', '导览进度')}/>
        <div className="deshou-dialogue"><Rabbit/><div><strong>{say('Little De Rabbit', '小德兔')}</strong><button className="deshou-bubble" type="button" onClick={() => advance()}><span aria-live="polite"><span key={`${current.id}-${page}-${language}`}>{pages[page]}</span></span><small>{page + 1}/{pages.length} · {page < pages.length - 1 ? say('Tap to continue', '点击继续') : index < stops.length - 1 ? say('Next stop', '下一站') : say('Finish tour', '结束导览')} →</small></button></div></div>
        {tour.id === 'family' && observations[current.id] && <div className="deshou-reading"><p>{observations[current.id][language][0]}</p>{observed ? <p role="status">{observations[current.id][language][1]}</p> : <button type="button" onClick={() => setObserved(true)}>{say('Reveal the clue', '查看线索')}</button>}</div>}
        <div className="deshou-actions"><button type="button" disabled={page === 0 && index === 0} onClick={() => { setObserved(false); setProgress({ ...progress, stop: page ? index : index - 1, page: page ? page - 1 : speechPages(stops[index - 1].description[language]).length - 1 }); }}>{say('Back', '上一段')}</button><button type="button" onClick={() => speak(pages[page])}>{speaking ? say('Stop audio', '停止朗读') : say('Listen', '听讲解')}</button><button type="button" onClick={() => advance(true)}>{say('Skip stop', '跳过此站')}</button><button type="button" aria-pressed={saved.includes(current.id)} onClick={() => save(current.id)}>{saved.includes(current.id) ? say('Saved', '已收藏') : say('Save stop', '收藏此站')}</button><button type="button" onClick={() => showArtifact(current.id, 'tour')}>{say('Open exhibit', '查看展品')}</button><button type="button" onClick={() => open('tours')}>{say('Pause tour', '暂停导览')}</button></div>
        {audioRate}{audioMessage && <p role="status">{audioMessage}</p>}<Sources record={current} label={say('Sources', '资料来源')}/>
      </article>}
      {view === 'complete' && <div className="deshou-reading"><Rabbit small/><h1 ref={heading} tabIndex={-1}>{say('Tour complete', '导览完成')}</h1><button type="button" onClick={() => open('saved')}>{say('Review your saved exhibits', '查看收藏展品')}</button></div>}
      {view === 'visit' && <><h1 ref={heading} tabIndex={-1}>{say('Visit information', '参观信息')}</h1><div className="deshou-reading"><h2>{say('Before you visit', '参观前准备')}</h2><p>{say('Check the museum’s WeChat account 南宋德寿宫遗址博物馆 or current on-site notices for opening hours, reservations, entrances, accessibility and photography rules.', '请通过馆方微信公众号「南宋德寿宫遗址博物馆」或现场公告确认开放时间、预约、入口、无障碍设施及拍摄规定。')}</p><a href="https://www.hzzx.gov.cn/cshz/content/2022-11/14/content_8399316.htm" target="_blank" rel="noreferrer">{say('Hangzhou Release exhibition background (2022)', '杭州发布展陈背景资料（2022 年）')}</a></div><div className="deshou-reading"><h2>{say('While exploring', '参观过程中')}</h2><p>{say('Follow the posted route and ask museum staff about lift access or gallery closures. The in-app tours group exhibits by theme.', '请遵守现场参观动线。电梯通行或展区临时关闭情况，请咨询工作人员。应用内导览按主题组织展品。')}</p></div></>}
    </div>
  </div>;
}
