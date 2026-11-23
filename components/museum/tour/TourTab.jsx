"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import dynamic from 'next/dynamic';
import { motion, useReducedMotion } from 'framer-motion';
import { GlossyButton, GlossyCard, SpeechBubble } from '../ui/Glossy.jsx';
import { initialTourState, tourReducer } from '../../../lib/museum-tour-state.js';
import styles from './TourTab.module.css';

const ExhibitionHallScene=dynamic(()=>import('./ExhibitionHallScene.jsx'),{ssr:false});
const local=(value,language)=>typeof value==='string'?value:value?.[language]||value?.en||'';

export default function TourTab({hall,halls,language,sceneHost,onSelectHall,saved,onToggleSaved}) {
  if(!hall) return <GlossyCard className={styles.empty}><h1>{language==='zh'?'展厅尚未就绪':'The gallery is not ready'}</h1><p>{language==='zh'?'请稍候，或使用下方重试按钮。':'Please wait, or use the retry control below.'}</p></GlossyCard>;
  return <TourSession key={hall.id} {...{hall,halls,language,sceneHost,onSelectHall,saved,onToggleSaved}}/>;
}

function TourSession({hall,halls,language,sceneHost,onSelectHall,saved,onToggleSaved}) {
  const [state,dispatch]=useReducer(tourReducer,undefined,initialTourState);
  const [sceneStatus,setSceneStatus]=useState('loading');
  const [idlePaused,setIdlePaused]=useState(false);
  const reduced=Boolean(useReducedMotion());
  const completion=useRef(null);
  const zh=language==='zh';
  const artifacts=hall.artifacts||[];
  const title=local(hall.name,language);
  const artifact=artifacts[state.currentArtifactIndex];
  const onLanded=useCallback(motionId=>dispatch({type:'LANDED',motionId}),[]);
  const onReady=useCallback(()=>setSceneStatus('ready'),[]);
  const onUnavailable=useCallback(()=>setSceneStatus('fallback'),[]);
  useEffect(()=>{
    if(sceneStatus==='fallback'&&state.phase==='moving') onLanded(state.motionId);
  },[sceneStatus,state.phase,state.motionId,onLanded]);
  useEffect(()=>{if(state.phase==='complete') completion.current?.focus();},[state.phase]);
  // A failed chunk or unavailable GPU must not trap the accessible text tour.
  useEffect(()=>{
    if(sceneStatus!=='loading') return;
    const timeout=setTimeout(onUnavailable,12000);
    return ()=>clearTimeout(timeout);
  },[sceneStatus,onUnavailable]);

  const announcement=state.phase==='moving'?(zh?'小德兔正在前往展品…':'Little De Rabbit is hopping to the exhibit…'):state.phase==='complete'?(zh?'导览结束':'Tour complete'):state.phase==='welcome'?(zh?'欢迎来到':'Welcome to ')+title:local(artifact?.name,language);
  return <div className={styles.tour} data-tour-phase={state.phase}>
    {sceneHost&&sceneStatus!=='fallback'&&createPortal(<ExhibitionHallScene hall={{...hall,artifacts}} state={state} onLanded={onLanded} onReady={onReady} onUnavailable={onUnavailable} reducedMotion={reduced} idlePaused={idlePaused}/>,sceneHost)}
    <div className={styles.heading}><p>{zh?'小德兔带你游':'A WALK WITH Little De Rabbit'}</p><h1>{title}</h1><span>{zh?'艺术化虚拟展厅 · 非实测复原':'An imagined gallery · not a measured reconstruction'}</span></div>
    <div className={styles.controls}><GlossyButton disabled={reduced} aria-pressed={idlePaused||reduced} onClick={()=>setIdlePaused(value=>!value)}>{reduced?(zh?'静态角色':'Still character'):idlePaused?(zh?'播放角色动画':'Resume idle animation'):(zh?'暂停角色动画':'Pause idle animation')}</GlossyButton></div>
    <p className={styles.srOnly} role="status" aria-live="polite">{announcement}</p>
    <div className={styles.bubblePosition}>
      <SpeechBubble speaker={zh?'小德兔 · 你的宫苑向导':'Little De Rabbit · YOUR PALACE GUIDE'} className={styles.bubble}>
        <motion.div key={`${state.phase}-${state.currentArtifactIndex}`} initial={reduced?false:{opacity:0,y:12}} animate={{opacity:1,y:0}} transition={{duration:reduced?0:.7,ease:[.42,0,.58,1]}}>
          {state.phase==='welcome'&&<><p className={styles.kicker}>{zh?'序章':'THE THRESHOLD'}</p><h2>{zh?`欢迎来到${title}`:`Welcome to ${title}`}</h2><p>{zh?'我是小德兔。跟随我的脚步，一起发现这座展厅的故事。':'I’m Little De Rabbit. Follow my footsteps and discover the story held within this gallery.'}</p><p className={styles.note}>{zh?`本次导览包含 ${artifacts.length} 件已核实的代表展品。`:`This tour features ${artifacts.length} documented exhibit${artifacts.length===1?'':'s'}.`}</p></>}
          {state.phase==='moving'&&<div className={styles.moving}><span aria-hidden="true">· · ·</span><h2>{zh?'随我来':'This way, softly…'}</h2><p>{zh?'下一段故事，就在前方。':'Our next story is just a few steps away.'}</p></div>}
          {state.phase==='artifact'&&artifact&&<>
            <p className={styles.kicker}>{String(state.currentArtifactIndex+1).padStart(2,'0')} / {String(artifacts.length).padStart(2,'0')}</p>
            <ArtifactImage key={artifact.id} artifact={artifact} language={language}/>
            <h2>{local(artifact.name,language)}</h2><p className={styles.commentary}>{local(artifact.description,language)}</p>
            <GlossyButton aria-pressed={saved.includes(artifact.id)} onClick={()=>onToggleSaved(artifact.id)}>
              {zh ? '收藏展品' : 'Save exhibit'}
            </GlossyButton>
          </>}
          {state.phase==='complete'&&<><p className={styles.kicker}>{zh?'故事未完':'THE STORY CONTINUES'}</p><h2 ref={completion} tabIndex={-1}>{zh?'导览结束':'Tour complete'}</h2><p>{zh?'下一站，想去哪里？':'Where shall we wander next?'}</p><div className={styles.halls}>{halls.map(item=><GlossyButton key={item.id} onClick={()=>item.id===hall.id?dispatch({type:'RESET'}):onSelectHall(item)}>{local(item.name,language)}{item.id===hall.id?(zh?' · 再次游览':' · Visit again'):''}<span aria-hidden="true"> ↗</span></GlossyButton>)}</div></>}
        </motion.div>
        {state.phase!=='complete'&&<div className={styles.nextRow}><span>{sceneStatus==='loading'?(zh?'正在开启展厅…':'Opening the gallery…'):sceneStatus==='fallback'?(zh?'文字导览模式':'Text tour mode'):zh?'慢行，细赏':'Take a moment. Look closely.'}</span><GlossyButton variant="gold" disabled={state.phase==='moving'||sceneStatus==='loading'} onClick={()=>dispatch({type:'NEXT',count:artifacts.length})}>{state.phase==='moving'?(zh?'前往中…':'Hopping…'):(zh?'下一步':'Next')} <span aria-hidden="true">→</span></GlossyButton></div>}
      </SpeechBubble>
    </div>
  </div>;
}

function ArtifactImage({artifact,language}) {
  const [failed,setFailed]=useState(false);
  if(!artifact.image_url||failed) return <div className={styles.noImage}>{language==='zh'?'此展品暂无已核实图片':'A verified image is not yet available for this exhibit.'}</div>;
  // Native image supports verified catalogue URLs without broad Next image host permissions.
  return <figure style={{margin:0}}><img className={styles.image} src={artifact.image_url} alt={local(artifact.name,language)} onError={()=>setFailed(true)} referrerPolicy="no-referrer"/>{artifact.image_credit && <figcaption style={{fontSize:11,lineHeight:1.6}}>{artifact.image_credit} · <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noreferrer">License</a></figcaption>}</figure>;
}
