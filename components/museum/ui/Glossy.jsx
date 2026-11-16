"use client";

import styles from "./Glossy.module.css";

export function GlossyCard({ as: Element = "div", className = "", children, ...props }) {
  return <Element {...props} className={`${styles.card} border border-white/25 bg-white/10 backdrop-blur-xl ${className}`}>{children}</Element>;
}

export function GlossyButton({ variant = "subtle", className = "", type = "button", children, ...props }) {
  return <button {...props} type={type} className={`${styles.button} ${variant === "gold" ? styles.gold : ""} ${className}`}>{children}</button>;
}

export function SpeechBubble({ speaker, children, className = "", ...props }) {
  return <GlossyCard {...props} as="article" className={`${styles.speech} ${className}`}>
    {speaker && <p className={styles.speaker}>{speaker}</p>}
    <div className={styles.words}>{children}</div>
  </GlossyCard>;
}
