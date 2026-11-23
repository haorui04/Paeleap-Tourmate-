"use client";

import { useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

const SONGTI = '"Noto Serif SC", "Source Han Serif SC", "Songti SC", STSong, SimSun, serif';
const SANS = '"Noto Sans SC", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif';
const EASE = [0.22, 1, 0.36, 1];
const COPY = {
  en: {
    title: "Little De Rabbit",
    subtitle: "Your museum companion",
    you: "You",
    welcome: "Every artifact holds a story.",
    invitation: "Ask about the collection, or follow a detail that catches your eye.",
    placeholder: "What would you like to discover?",
    label: "Message your museum guide",
    send: "Send message",
    thinking: "Preparing your response…",
    failed: "Your message couldn't be sent. Please try again.",
    hint: "Enter to send · Shift + Enter for a new line",
    note: "AI guide · Confirm details with museum sources.",
    conversation: "Museum conversation",
  },
  zh: {
    title: "小德兔",
    subtitle: "你的博物馆导览伙伴",
    you: "你",
    welcome: "一器一物，皆有故事。",
    invitation: "聊聊眼前的藏品，或从一个让你好奇的细节开始。",
    placeholder: "今天想了解什么？",
    label: "向博物馆向导提问",
    send: "发送消息",
    thinking: "正在准备回复…",
    failed: "消息未能发送，请重试。",
    hint: "回车发送 · Shift + 回车换行",
    note: "AI 导览 · 请以博物馆资料为准。",
    conversation: "博物馆对话",
  },
};

/**
 * Controlled conversation UI; the parent owns history and API calls.
 * messages: [{ id: string, role: "user" | "assistant", content: string }]
 * onSend(text): Promise<void> | void; reject (or return false) on failure.
 * Keep IDs stable while streaming. Remount with key={conversationId} on trip changes.
 */
export default function GlassChatbot({
  messages = [],
  onSend,
  isLoading = false,
  error = "",
  language = "en",
  title,
  maxLength = 1500,
  className = "",
  children,
  attachmentControl, attachmentPreview, hasAttachment = false, preparingAttachment = false, renderUserImage,
}) {
  const copy = COPY[language] || COPY.en;
  const guideName = title || copy.title;
  const id = useId();
  const reducedMotion = useReducedMotion();
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sendError, setSendError] = useState("");
  const submitLock = useRef(false);
  const followLatest = useRef(true);
  const transcript = useRef(null);
  const textarea = useRef(null);
  const busy = isLoading || submitting;
  const unavailable = typeof onSend !== "function";
  const visibleMessages = messages.filter(({ role }) => role === "user" || role === "assistant");
  const lastMessage = visibleMessages.at(-1);
  const feedback = sendError || error;

  useEffect(() => {
    const node = transcript.current;
    if (node && followLatest.current) node.scrollTop = node.scrollHeight;
  }, [visibleMessages.length, lastMessage?.content, busy]);

  useEffect(() => {
    const node = textarea.current;
    if (!node) return;
    node.style.height = "auto";
    node.style.height = `${Math.min(node.scrollHeight, 112)}px`;
  }, [draft]);

  async function submit(event) {
    event.preventDefault();
    const content = draft.trim();
    if ((!content && !hasAttachment) || preparingAttachment || content.length > maxLength || busy || submitLock.current || unavailable) return;

    submitLock.current = true;
    setSubmitting(true);
    setSendError("");
    setDraft("");
    followLatest.current = true;
    try {
      const result = await onSend(content);
      if (result === false) throw new Error("Send rejected");
    } catch {
      setDraft(content);
      setSendError(copy.failed);
    } finally {
      submitLock.current = false;
      setSubmitting(false);
    }
  }

  const enter = reducedMotion ? false : { opacity: 0, y: 14 };
  const transition = { duration: reducedMotion ? 0 : 0.45, ease: EASE };

  return (
    <motion.section
      aria-labelledby={`${id}-title`}
      lang={language === "zh" ? "zh-CN" : "en"}
      initial={reducedMotion ? false : { opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...transition, duration: reducedMotion ? 0 : 0.7 }}
      className={`fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-20 flex h-[min(38rem,72dvh)] w-[calc(100%-2rem)] max-w-[27rem] flex-col overflow-hidden rounded-[1.75rem] border border-white/20 bg-white/10 text-[#f7f3e9] shadow-[0_28px_90px_-20px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.18)] backdrop-blur-xl sm:right-8 sm:bottom-8 ${className}`}
      style={{ fontFamily: SANS, backgroundImage: "linear-gradient(145deg, rgba(32,59,50,.78), rgba(16,35,29,.86))" }}
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-8 top-0 h-px bg-linear-to-r from-transparent via-[#e8d49b]/60 to-transparent" />

      <header className="flex shrink-0 items-center gap-3 border-b border-white/10 px-5 py-4 sm:px-6">
        <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full border border-[#d8b969]/30 bg-[#d8b969]/10 text-xl text-[#e8d49b]" style={{ fontFamily: SONGTI }}>
          宋
        </span>
        <div className="min-w-0">
          <h2 id={`${id}-title`} className="m-0 truncate text-lg font-normal tracking-wide" style={{ fontFamily: SONGTI }}>{guideName}</h2>
          <p className="m-0 mt-1 text-xs tracking-wide text-[#c6ddd0]">{copy.subtitle}</p>
        </div>
      </header>

      {children ? <div className="flex min-h-0 flex-1 flex-col">{children}</div> : <>
      <div
        ref={transcript}
        role="log"
        aria-label={copy.conversation}
        aria-live="polite"
        aria-relevant="additions text"
        tabIndex={0}
        onScroll={(event) => {
          const node = event.currentTarget;
          followLatest.current = node.scrollHeight - node.scrollTop - node.clientHeight < 64;
        }}
        className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-5 py-6 [scrollbar-color:#7ca68f55_transparent] [scrollbar-width:thin] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#d8b969] sm:px-6"
      >
        {visibleMessages.length === 0 && (
          <div className="py-7 text-center">
            <p className="m-0 text-xl leading-relaxed text-[#f7f3e9]" style={{ fontFamily: SONGTI }}>{copy.welcome}</p>
            <p className="mx-auto mb-0 mt-3 max-w-64 text-sm leading-7 text-[#c6ddd0]">{copy.invitation}</p>
          </div>
        )}

        <AnimatePresence initial={false}>
          {visibleMessages.map((message) => {
            const user = message.role === "user";
            return (
              <motion.div
                key={message.id}
                initial={enter}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, transition: { duration: reducedMotion ? 0 : 0.15 } }}
                transition={transition}
                className={`flex flex-col ${user ? "items-end" : "items-start"}`}
              >
                <span className="mb-2 px-1 text-[11px] tracking-wide text-[#c6ddd0]">{user ? copy.you : guideName}</span>
                <div
                  className={`max-w-[92%] whitespace-pre-wrap rounded-2xl border px-4 py-3 text-[15px] leading-[1.85] [overflow-wrap:anywhere] ${user ? "rounded-tr-sm border-[#a3c5b2]/25 bg-[#7ca68f]/20" : "rounded-tl-sm border-white/10 bg-white/5"}`}
                  style={{ fontFamily: user ? SANS : SONGTI }}
                >
                  {message.content}
                  {user && renderUserImage?.(message)}
                  {!user && (message.image_url?.startsWith("/artifacts/") || message.image_url?.startsWith("https://")) && <img src={message.image_url} alt={message.artifact_name || "Museum artifact"} loading="lazy" referrerPolicy="no-referrer" className="mt-3 max-h-64 w-full rounded-xl object-contain" onError={event=>{event.currentTarget.hidden=true;}} />}
                  {!user && message.image_credit && <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noreferrer" className="mt-2 block text-xs underline">{message.image_credit}</a>}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {busy && <p className="m-0 text-xs tracking-wide text-[#e8d49b]">{copy.thinking}</p>}
      </div>

      <footer className="shrink-0 border-t border-white/10 bg-[#10231d]/30 px-4 pb-4 pt-3 sm:px-5">
        {feedback && <p id={`${id}-error`} role="alert" className="m-0 mb-3 text-sm leading-relaxed text-[#f4c9b8]">{feedback}</p>}
        {attachmentPreview}
        <form onSubmit={submit} className="flex items-end gap-2 rounded-full backdrop-blur-xl border border-white/25 bg-[#10231d]/40 p-2 transition-colors focus-within:border-[#d8b969]/60">
          {attachmentControl && (
            <div className="grid min-h-11 flex-none place-items-center">{attachmentControl}</div>
          )}
          <label htmlFor={`${id}-input`} className="sr-only">{copy.label}</label>
          <textarea
            ref={textarea}
            id={`${id}-input`}
            value={draft}
            onChange={(event) => { setDraft(event.target.value); setSendError(""); }}
            onKeyDown={(event) => {
              // Let Chinese IME confirmation finish without submitting a message.
              if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing && event.keyCode !== 229) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
            rows={1}
            maxLength={maxLength}
            readOnly={busy || unavailable}
            aria-describedby={`${id}-hint${feedback ? ` ${id}-error` : ""}`}
            placeholder={copy.placeholder}
            className={`max-h-28 min-h-11 min-w-0 flex-1 resize-none border-0 bg-transparent pr-2 py-3 text-left text-sm leading-5 text-[#f7f3e9] outline-none placeholder:text-[#a3c5b2] ${attachmentControl ? "pl-0" : "pl-2"}`}
          />
          <motion.button
            type="submit"
            aria-label={copy.send}
            disabled={busy || unavailable || preparingAttachment || (!draft.trim() && !hasAttachment)}
            whileHover={reducedMotion || busy || unavailable || preparingAttachment || (!draft.trim() && !hasAttachment) ? undefined : { y: -1 }}
            whileTap={reducedMotion ? undefined : { scale: 0.96 }}
            className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-[#e8d49b]/50 bg-[#d8b969] text-[#10231d] transition-colors hover:bg-[#e8d49b] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e8d49b] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <svg aria-hidden="true" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 19V5m-6 6 6-6 6 6" />
            </svg>
          </motion.button>
        </form>
        <p id={`${id}-hint`} className="mb-0 mt-2 px-1 text-[10px] leading-4 text-[#c6ddd0]">{copy.hint}</p>
        <p className="mb-0 mt-1 px-1 text-[10px] leading-4 text-[#a3c5b2]">{copy.note}</p>
      </footer>
      </>}
    </motion.section>
  );
}
