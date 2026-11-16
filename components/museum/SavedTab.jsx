"use client";
import { GlossyCard } from './ui/Glossy.jsx';
import { exhibitLink } from '../../lib/museum-guide.js';
import styles from './SavedTab.module.css';
export default function SavedTab({ halls, saved, language }) {
  const artifacts = halls.flatMap(hall => hall.artifacts || []).filter(artifact => saved.includes(artifact.id));
  return <div className={styles.space}><GlossyCard className={styles.empty}>
    {artifacts.length ? <ul>{artifacts.map(artifact => <li key={artifact.id}>
      <a href={exhibitLink(artifact.id)}>{artifact.name[language]}</a>
    </li>)}</ul> : <p>{language === 'zh' ? '暂无收藏展品' : 'No Saved Artifacts'}</p>}
  </GlossyCard></div>;
}
