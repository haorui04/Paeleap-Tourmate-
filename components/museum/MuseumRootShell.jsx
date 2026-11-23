"use client";
import { AuthProvider, ProfileControl, useMuseumAuth } from "./auth/AuthContext.jsx";


import { createContext, useContext, useEffect, useId, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import dynamic from "next/dynamic";
import SavedTab from "./SavedTab.jsx";
import AskTab from "./AskTab.jsx";
import ExploreTab from "./explore/ExploreTab.jsx";
import TourTab from "./tour/TourTab.jsx";
import { GlossyButton, GlossyCard } from "./ui/Glossy.jsx";
import styles from "./MuseumRootShell.module.css";

const AskBackgroundScene = dynamic(() => import("./scene/AskBackgroundScene.jsx"), { ssr:false });
const MuseumShellContext = createContext(null);
const TABS = ["Explore", "Tour", "Ask", "Saved"];
const LABELS = { Explore: "探索", Tour: "导览", Ask: "提问", Saved: "收藏" };
const MuseumBackgroundScene = dynamic(() => import("./scene/MuseumBackgroundScene.jsx"), { ssr: false });

function MuseumWordmark() {
  return (
    <span className={styles.wordmark}>
      <img src="/paeleap-museum-logo.png" alt="Paeleap" width={900} height={400} />
    </span>
  );
}

export function useMuseumShell() {
  const context = useContext(MuseumShellContext);
  if (!context) throw new Error("useMuseumShell must be used inside MuseumRootShell");
  return context;
}

/** Owns shared museum state. Future tab components consume useMuseumShell(). */
function MuseumShell({ language = "en", onLanguageChange, onSignOut, isAuthenticated = false, museumTitle, chatProps }) {
  const auth = useMuseumAuth();
  const [activeTab, changeTab] = useState("Explore");
  const setActiveTab = tab => tab === "Explore" ? changeTab(tab) : auth.request(() => changeTab(tab));
  useEffect(() => { if (!auth.user) { changeTab("Explore"); setDisplayedTab("Explore"); } }, [auth.user]);
  const [displayedTab, setDisplayedTab] = useState("Explore");
  const [selectedHall, setSelectedHall] = useState(null);
  const [halls, setHalls] = useState([]);
  const [artifactId, setArtifactId] = useState(null);
  const [saved, setSaved] = useState([]);
  const [hallStatus, setHallStatus] = useState("loading");
  const [attempt, setAttempt] = useState(0);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState(false);
  const [scenePaused, setScenePaused] = useState(false);
  const [tourSceneHost, setTourSceneHost] = useState(null);
  const shellRef = useRef(null);
  const focusTour = useRef(false);
  const tabRefs = useRef([]);
  const id = useId();
  const reduced = useReducedMotion();
  const zh = language === "zh";
  const switching = activeTab !== displayedTab;
  useEffect(() => {
    setArtifactId(new URLSearchParams(window.location.search).get("artifact"));
    try {
      const stored = JSON.parse(localStorage.getItem("deshou-guide-v1") || "{}");
      if (Array.isArray(stored.saved)) setSaved(stored.saved.filter(id => typeof id === "string"));
    } catch { /* The guide also works without local storage. */ }
  }, []);

  function toggleSaved(id) {
    const next = saved.includes(id) ? saved.filter(item => item !== id) : [...saved, id];
    setSaved(next);
    try {
      const stored = JSON.parse(localStorage.getItem("deshou-guide-v1") || "{}");
      localStorage.setItem("deshou-guide-v1", JSON.stringify({ ...stored, saved: next }));
    } catch { /* The bookmark remains available for this visit. */ }
  }
  useEffect(() => {
    if (!switching) return;
    const timer = window.setTimeout(() => {
      shellRef.current?.scrollTo({top:0,behavior:"instant"});
      setDisplayedTab(activeTab);
    }, reduced ? 0 : 180);
    return () => window.clearTimeout(timer);
  }, [activeTab, switching, reduced]);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const timeout = window.setTimeout(() => controller.abort(), 15000);
    setHallStatus("loading");
    fetch("/api/museum/halls", { signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error("Catalogue unavailable");
      const data = await response.json();
      if (!Array.isArray(data.halls)) throw new Error("Missing hall catalogue");
      const available = data.halls.filter(hall => typeof hall.id === "string" && typeof hall.name?.en === "string" && typeof hall.name?.zh === "string");
      if (!active) return;
      setHalls(available);
      setSelectedHall(previous => available.find(hall => hall.id === previous?.id) || available[0] || null);
      setHallStatus(available.length ? "ready" : "empty");
    }).catch(() => { if (active) setHallStatus("error"); })
      .finally(() => window.clearTimeout(timeout));
    return () => { active = false; controller.abort(); window.clearTimeout(timeout); };
  }, [attempt]);

  const context = useMemo(() => ({
    activeTab, selectedHall, halls, hallStatus,
    setActiveTab: tab => { if (TABS.includes(tab)) setActiveTab(tab); },
    setSelectedHall: hall => {
      const match = halls.find(item => item.id === (typeof hall === "string" ? hall : hall?.id));
      if (match) setSelectedHall(match);
    },
  }), [activeTab, selectedHall, halls, hallStatus, auth.user]);

  function navigate(event, index) {
    let next;
    if (event.key === "ArrowRight") next = (index + 1) % TABS.length;
    if (event.key === "ArrowLeft") next = (index + TABS.length - 1) % TABS.length;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = TABS.length - 1;
    if (next === undefined) return;
    event.preventDefault(); setActiveTab(TABS[next]); tabRefs.current[next]?.focus();
  }

  async function signOut() {
    if (signingOut) return;
    setSigningOut(true); setSignOutError(false);
    try { await onSignOut?.(); } catch { setSignOutError(true); }
    finally { setSigningOut(false); }
  }

  useEffect(() => {
    if (displayedTab !== "Tour" || !focusTour.current) return;
    focusTour.current = false;
    shellRef.current?.scrollTo({ top: 0, behavior: "instant" });
    document.getElementById(`${id}-Tour-panel`)?.focus({ preventScroll: true });
  }, [displayedTab, id]);

  function startTour(hall) {
    const published = halls.find(item => item.id === hall.id);
    if (!published) return;
    auth.request(() => {
      focusTour.current = true;
      setSelectedHall(published);
      changeTab("Tour");
    });
  }

  return <MuseumShellContext.Provider value={context}>
    <div ref={shellRef} className={styles.shell} lang={zh ? "zh-CN" : "en"}>
      <div className={styles.atmosphere} aria-hidden="true" />
      <motion.div className={styles.sceneLayer} initial={false} animate={{opacity:switching ? 0 : 1}} transition={{duration:reduced ? 0 : .18}}>
      {displayedTab === "Explore" && <MuseumBackgroundScene paused={scenePaused} reducedMotion={Boolean(reduced)} />}
      {displayedTab === "Tour" && <div ref={setTourSceneHost} className={styles.tourScene} aria-hidden="true" data-tour-scene />}
      {displayedTab === "Ask" && !reduced && <div className={styles.tourScene} aria-hidden="true"><AskBackgroundScene /></div>}
      </motion.div>
      <GlossyCard as="header" className={styles.header}>
        <a className={styles.brand} href="/?persona=little-de-rabbit" aria-label={zh ? "德寿宫博物馆首页" : "Deshou Palace museum home"}>
          <MuseumWordmark />
          <span><span className={styles.eyebrow}>{zh ? "南宋 · 杭州" : "SOUTHERN SONG · HANGZHOU"}</span>
            <span className={styles.museumTitle}>{museumTitle || (zh ? "南宋德寿宫遗址博物馆" : "Deshou Palace Ruins Museum")}</span></span>
        </a>
        <div className={styles.actions}>
          <div className={styles.languages} role="group" aria-label={zh ? "语言" : "Language"}>
            <GlossyButton aria-pressed={!zh} onClick={() => onLanguageChange?.("en")}>EN</GlossyButton>
            <GlossyButton aria-pressed={zh} onClick={() => onLanguageChange?.("zh")}>中文</GlossyButton>
          </div>
          <ProfileControl />
        </div>
      </GlossyCard>
      {signOutError && <p role="alert" className={styles.notice}>{zh ? "退出失败，请重试。" : "Could not sign out. Please try again."}</p>}

      <main className={styles.main}>
        <GlossyCard className={styles.tabs} role="tablist" aria-label={zh ? "博物馆导航" : "Museum navigation"}>
          {TABS.map((tab, index) => <button key={tab} ref={node => { tabRefs.current[index] = node; }}
            type="button" role="tab" id={`${id}-${tab}`} aria-controls={`${id}-${tab}-panel`}
            aria-selected={activeTab === tab} tabIndex={activeTab === tab ? 0 : -1}
            onClick={() => setActiveTab(tab)} onKeyDown={event => navigate(event, index)} className={styles.tab}>
            {zh ? LABELS[tab] : tab}
          </button>)}
        </GlossyCard>

        {displayedTab === "Explore" && <div className={styles.sceneControls}>
          <GlossyButton disabled={Boolean(reduced)} aria-pressed={scenePaused || Boolean(reduced)} onClick={() => setScenePaused(value => !value)}>
            {reduced ? (zh ? "静态景观" : "Still scene") : scenePaused ? (zh ? "播放景观动画" : "Play scene") : (zh ? "暂停景观动画" : "Pause scene")}
          </GlossyButton>
        </div>}

        {TABS.map(tab => <motion.section key={tab} role="tabpanel" id={`${id}-${tab}-panel`}
          aria-labelledby={`${id}-${tab}`} hidden={displayedTab !== tab} initial={false} animate={{opacity:switching ? 0 : 1,filter: switching && !reduced ? "blur(5px)" : "blur(0px)"}} transition={{duration: reduced ? 0 : .18}} tabIndex={0} className={`${styles.panel} ${styles.explorePanel}`}>
          {displayedTab === tab && (tab === "Explore" ? <ExploreTab language={language} halls={halls} hallStatus={hallStatus} artifactId={artifactId} onStartTour={startTour} onRetry={() => setAttempt(value => value + 1)} /> : tab === "Ask" ? <AskTab {...chatProps} language={language} /> : tab === "Tour" ? <TourTab hall={selectedHall} halls={halls} language={language} sceneHost={tourSceneHost} onSelectHall={context.setSelectedHall} saved={saved} onToggleSaved={toggleSaved} /> : <SavedTab halls={halls} saved={saved} language={language} />)}
        </motion.section>)}
      </main>

      <footer className={styles.footer}>
        <span>{zh ? "一方宫苑 · 八百年回响" : "A palace. Eight centuries of stories."}</span>
        <div role="status" aria-live="polite">
          {hallStatus === "loading" && (zh ? "正在加载展厅…" : "Loading exhibition halls…")}
          {hallStatus === "ready" && `${zh ? "当前展厅" : "Selected hall"} · ${selectedHall?.name[language] || selectedHall?.name.en}`}
          {hallStatus === "empty" && (zh ? "暂无已发布展厅" : "No published halls available")}
          {hallStatus === "error" && <>{zh ? "展厅暂不可用 " : "Halls unavailable "}<GlossyButton onClick={() => setAttempt(value => value + 1)}>{zh ? "重试" : "Retry"}</GlossyButton></>}
        </div>
      </footer>
    </div>
  </MuseumShellContext.Provider>;
}




export function MuseumEntryStatus({ language, failed, onRetry }) {
  const zh = language === "zh";
  return <main className={`${styles.shell} ${styles.entry}`} lang={zh ? "zh-CN" : "en"}>
    <div className={styles.atmosphere} aria-hidden="true" />
    <GlossyCard className={styles.entryCard}>
      <MuseumWordmark />
      <h1>{zh ? "德寿宫" : "Deshou Palace"}</h1>
      {failed ? <>
        <p role="alert">{zh ? "小德兔导览暂不可用。" : "The Little De Rabbit guide is temporarily unavailable."}</p>
        <GlossyButton onClick={onRetry}>{zh ? "重试" : "Try again"}</GlossyButton>
      </> : <p role="status">{zh ? "正在准备小德兔导览…" : "Preparing the Little De Rabbit guide…"}</p>}
    </GlossyCard>
  </main>;
}

export default function MuseumRootShell({session,authClient,...props}) { return <AuthProvider session={session} client={authClient} onSignOut={props.onSignOut}><MuseumShell {...props}/></AuthProvider>; }
