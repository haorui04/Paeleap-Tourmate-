"use client";

import { useEffect, useRef } from "react";

export default function DeleteChatDialog({ trip, busy, error, language, onCancel, onConfirm }) {
  const dialog = useRef(null);
  const cancel = useRef(null);
  const zh = language === "zh";
  useEffect(() => {
    const node = dialog.current;
    if (trip && !node.open) { node.showModal(); cancel.current?.focus(); }
    if (!trip && node.open) node.close();
  }, [trip?.id]);
  return <dialog ref={dialog} className="delete-dialog" aria-labelledby="delete-title" aria-describedby="delete-description"
    onCancel={event => { event.preventDefault(); if (!busy) onCancel(); }}>
    <div className="delete-symbol" aria-hidden="true"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/></svg></div>
    <h2 id="delete-title">{zh ? "删除这个行程对话？" : "Delete this conversation?"}</h2>
    <p className="delete-trip-name">{trip?.title || (zh ? "新行程" : "New trip")}</p>
    <p id="delete-description">{zh ? "这将永久删除此对话及其所有消息，并从你的账户和此浏览器中移除。此操作无法撤销。" : "This permanently removes the conversation and all its messages from your account and this browser. This cannot be undone."}</p>
    {error && <p className="dialog-error" role="alert">{error}</p>}
    <div className="dialog-actions">
      <button ref={cancel} type="button" className="secondary-button" disabled={busy} onClick={onCancel}>{zh ? "保留对话" : "Keep conversation"}</button>
      <button type="button" className="danger-button" disabled={busy} onClick={onConfirm}>{busy ? (zh ? "正在删除…" : "Deleting…") : (zh ? "永久删除" : "Delete conversation")}</button>
    </div>
  </dialog>;
}
