"use client";
import { useEffect, useState } from "react";

export default function ThinkingIndicator({ language, avatar }) {
  const [takingLonger, setTakingLonger] = useState(false);
  useEffect(() => { const timer = setTimeout(() => setTakingLonger(true), 12000); return () => clearTimeout(timer); }, []);
  const zh = language === "zh";
  return <div className="message-row assistant-row thinking-row" role="status" aria-live="polite">
    <div className="assistant-avatar thinking-avatar" aria-hidden="true">{avatar}</div>
    <div className="thinking-card">
      <div className="thinking-heading"><span className="thinking-dots" aria-hidden="true"><i/><i/><i/></span>
        <span>{zh ? "正在准备回复" : "Preparing your response"}</span></div>
      <p>{takingLonger ? (zh ? "稍等片刻，复杂问题可能需要更长时间。" : "A little longer for a thoughtful answer. You can stop at any time.") : (zh ? "你的旅行问题，值得用心解答。" : "A little guidance for your next adventure.")}</p>
      <div className="thinking-track" aria-hidden="true"><span/></div>
    </div>
  </div>;
}
