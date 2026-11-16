"use client";

import { motion, useReducedMotion } from "framer-motion";
import { GlossyButton, GlossyCard } from "../ui/Glossy.jsx";
import styles from "./ExploreTab.module.css";

/** All hall data and navigation callbacks come from the root catalogue/context. */
export default function ExploreTab({ language = "en", halls, hallStatus, artifactId, onStartTour, onRetry }) {
  const zh = language === "zh";
  const reduced = useReducedMotion();
  const artifact = artifactId && halls.flatMap(hall => hall.artifacts || []).find(item => item.id === artifactId);

  return <motion.div className={styles.explore}
    initial={reduced ? false : { opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: reduced ? 0 : 0.9, ease: [0.65, 0, 0.35, 1] }}>
    {artifact ? <GlossyCard as="section" className={styles.sharedArtifact} aria-labelledby="shared-artifact">
      <h1 id="shared-artifact">{artifact.name[language]}</h1>
      <p>{artifact.description[language]}</p>
    </GlossyCard> : <section className={styles.hero} aria-labelledby="explore-welcome">
      <p className={styles.kicker}><span />{zh ? "南宋风雅 · 宫苑寻踪" : "A JOURNEY INTO SOUTHERN SONG ELEGANCE"}</p>
      <h1 id="explore-welcome">{zh ? <>欢迎来到<br /><em>德寿宫</em></> : <>Welcome to<br /><em>Deshou Palace</em></>}</h1>
      <p className={styles.subtitle}>{zh ? "循着一重檐影、一方庭院，走近南宋宫苑与临安生活的故事。" : "Beyond the eaves, a quieter world. Discover the courtyards, collections and stories of Southern Song Hangzhou."}</p>
      <a className={styles.discover} href="#exhibition-halls">{zh ? "选择展厅，开启探索" : "Find your path through the palace"}<span aria-hidden="true">↓</span></a>
      <p className={styles.sceneNote}>{zh ? "宫苑艺术示意 · 非考古复原图" : "Artistic palace overview · not an archaeological reconstruction"}</p>
      {artifactId && ["ready", "empty"].includes(hallStatus) && <p role="status">{zh ? "此展品目前不在导览目录中。" : "This exhibit is currently unavailable in the tour catalogue."}</p>}
    </section>}

    <section id="exhibition-halls" className={styles.halls} aria-labelledby="hall-heading" aria-busy={hallStatus === "loading"}>
      <div className={styles.sectionHeading}><h2 id="hall-heading">{zh ? "入境 · 寻馆" : "Choose your chapter"}</h2><span>{zh ? "展厅与主题展区" : "HALLS & EXHIBITION ZONES"}</span></div>
      {hallStatus === "loading" && <GlossyCard className={styles.state} role="status">{zh ? "正在准备展厅导览…" : "Preparing the exhibition halls…"}</GlossyCard>}
      {hallStatus === "error" && <GlossyCard className={styles.state} role="alert"><p>{zh ? "暂时无法加载展厅，请重试。" : "The halls could not be loaded. Please try again."}</p><GlossyButton onClick={onRetry}>{zh ? "重试" : "Retry"}</GlossyButton></GlossyCard>}
      {hallStatus === "empty" && <GlossyCard className={styles.state}>{zh ? "暂无已发布展厅，请稍后再来。" : "No halls are published yet. Please check back later."}</GlossyCard>}
      {hallStatus === "ready" && <div className={styles.grid}>
        {halls.map((hall, index) => <GlossyCard as="article" key={hall.id} className={styles.hall}>
          <div className={styles.cardTop}><span>{String(index + 1).padStart(2, "0")}</span><span aria-hidden="true">⌁</span></div>
          <h3>{hall.name[language] || hall.name.en}</h3>
          <p>{hall.summary?.[language] || hall.summary?.en || (zh ? "跟随导览，了解这一展区的藏品与故事。" : "Follow the guide to discover the objects and stories of this exhibition zone.")}</p>
          <GlossyButton variant="gold" onClick={() => onStartTour(hall)}
            aria-label={`${zh ? "开始导览" : "Start Guided Tour"} — ${hall.name[language] || hall.name.en}`}>
            {zh ? "开始导览" : "Start Guided Tour"}<span aria-hidden="true">↗</span>
          </GlossyButton>
        </GlossyCard>)}
      </div>}
    </section>
  </motion.div>;
}
