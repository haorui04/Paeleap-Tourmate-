"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import AuthPanel from "./AuthPanel.jsx";
import useTripHistory from "./useTripHistory.js";
import { getSupabaseBrowserClient } from "../lib/client/supabase.js";
import { localHistoryForRequest } from "../lib/client/trips.js";
import {
  MAX_MESSAGE_LENGTH,
  SAFETY_LABELS,
  buildChatBody,
  chatErrorMessage,
  makeMessageId,
  parseChatResponse
} from "../lib/client/chat.js";

const text = {
  en: {
    brandTag: "AI TOUR COMPANION",
    newTrip: "New trip",
    recent: "CURRENT TRIPS",
    untitledTrip: "New trip",
    tripNavigation: "Saved trips",
    openTrips: "Open trips",
    closeTrips: "Close trips",
    historyLoading: "Loading your saved conversation…",
    historyError: "Your saved conversation couldn't be loaded. Try again.",
    syncError: "Saved trips couldn't be synced. Your local chats are still available.",
    storageError: "This browser couldn't save your history. Chats will remain available while this page is open.",
    emptyTrip: "Your first plan starts here",
    trustTitle: "Designed for safer travel",
    trustBody: "TourMate checks requests against travel-safety rules and uses curated heritage sources.",
    disclaimer: "AI can make mistakes. Confirm live hours, prices and transport with official providers.",
    signOut: "Sign out",
    localDemo: "Local demo",
    localAi: "Local AI",
    privateSession: "Private session",
    unavailable: "Status unavailable",
    connectionTitle: "Let's reconnect",
    connectionBody: "TourMate couldn't reach the chat service. Check your connection and try again.",
    retry: "Try again",
    welcomeKicker: "WELCOME TO HANGZHOU",
    welcomeTitle: "Where should we explore?",
    welcomeBody: "Ask for heritage highlights, a gentle one-day plan, or context about the places around West Lake.",
    composerLabel: "Ask TourMate",
    placeholder: "Ask about Hangzhou, West Lake, or a day itinerary…",
    send: "Send message",
    stop: "Stop response",
    enterHint: "Enter to send · Shift + Enter for a new line",
    sourceTitle: "Verified references",
    copied: "Copied",
    copy: "Copy response",
    dismiss: "Dismiss",
    thinking: "Looking through the travel notes",
    loading: "Preparing your travel space…",
    today: "Current conversation",
    suggestions: [
      { title: "Plan a calm day", body: "Create a one-day Hangzhou itinerary", prompt: "Plan a calm one-day trip around Hangzhou's verified heritage attractions." },
      { title: "Explore West Lake", body: "Learn what makes it significant", prompt: "Tell me about West Lake and why it is culturally significant." },
      { title: "Walk through history", body: "Compare two heritage places", prompt: "Compare West Lake and the Grand Canal for a history-focused visitor." }
    ]
  },
  zh: {
    brandTag: "AI 智能旅行伴侣",
    newTrip: "新行程",
    recent: "所有行程",
    untitledTrip: "新行程",
    tripNavigation: "已保存行程",
    openTrips: "打开行程列表",
    closeTrips: "关闭行程列表",
    historyLoading: "正在加载已保存的对话…",
    historyError: "无法加载已保存的对话，请重试。",
    syncError: "无法同步已保存行程，本地对话仍可使用。",
    storageError: "浏览器无法保存历史记录。当前页面保持打开时仍可查看对话。",
    emptyTrip: "从这里开始你的第一个计划",
    trustTitle: "为安心旅行而设计",
    trustBody: "TourMate 会依据旅行安全规则检查请求，并使用经过整理的遗产资料。",
    disclaimer: "AI 可能出错。实时开放时间、票价和交通信息请以官方渠道为准。",
    signOut: "退出登录",
    localDemo: "本地演示",
    localAi: "本地 AI",
    privateSession: "私密会话",
    unavailable: "状态不可用",
    connectionTitle: "请重新连接",
    connectionBody: "无法连接到聊天服务，请检查网络后重试。",
    retry: "重试",
    welcomeKicker: "欢迎来到杭州",
    welcomeTitle: "今天想去哪里探索？",
    welcomeBody: "你可以询问文化遗产亮点、轻松的一日游计划，或了解西湖周边景点。",
    composerLabel: "询问 TourMate",
    placeholder: "询问杭州、西湖或一日游行程…",
    send: "发送消息",
    stop: "停止回复",
    enterHint: "按 Enter 发送 · Shift + Enter 换行",
    sourceTitle: "已核实参考资料",
    copied: "已复制",
    copy: "复制回复",
    dismiss: "关闭",
    thinking: "正在查阅旅行资料",
    loading: "正在准备你的旅行空间…",
    today: "当前对话",
    suggestions: [
      { title: "规划轻松的一天", body: "制定杭州一日游行程", prompt: "请根据已核实的杭州文化遗产景点，规划轻松的一日游。" },
      { title: "探索西湖", body: "了解它的重要意义", prompt: "请介绍西湖及其文化意义。" },
      { title: "漫步历史", body: "比较两处文化遗产", prompt: "请为喜欢历史的游客比较西湖和大运河。" }
    ]
  }
};

function Icon({ name, size = 20 }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true };
  if (name === "plus") return <svg {...common}><path d="M12 5v14M5 12h14" /></svg>;
  if (name === "menu") return <svg {...common}><path d="M4 6h16M4 12h16M4 18h16" /></svg>;
  if (name === "close") return <svg {...common}><path d="m6 6 12 12M18 6 6 18" /></svg>;
  if (name === "send") return <svg {...common}><path d="m21 3-7.5 18-4.2-7.8L3 9l18-6Z" /><path d="m9.3 13.2 4.2-4.2" /></svg>;
  if (name === "shield") return <svg {...common}><path d="M12 3 5 6v5c0 4.8 2.8 8.1 7 10 4.2-1.9 7-5.2 7-10V6l-7-3Z" /><path d="m9 12 2 2 4-5" /></svg>;
  if (name === "copy") return <svg {...common}><rect x="8" y="8" width="11" height="11" rx="2" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></svg>;
  if (name === "link") return <svg {...common}><path d="M10 13a5 5 0 0 0 7.5.5l2-2a5 5 0 0 0-7-7l-1.1 1.1" /><path d="M14 11a5 5 0 0 0-7.5-.5l-2 2a5 5 0 0 0 7 7l1.1-1.1" /></svg>;
  if (name === "spark") return <svg {...common}><path d="m12 3 1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3Z" /><path d="m19 15 .7 2.3L22 18l-2.3.7L19 21l-.7-2.3L16 18l2.3-.7L19 15Z" /></svg>;
  if (name === "stop") return <svg {...common}><rect x="6" y="6" width="12" height="12" rx="2" /></svg>;
  if (name === "logout") return <svg {...common}><path d="M10 17l5-5-5-5M15 12H3" /><path d="M15 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" /></svg>;
  return null;
}

function Brand() {
  return (
    <div className="brand" aria-label="Paeleap TourMate">
      <span className="brand-symbol" aria-hidden="true"><span>旅</span></span>
      <span className="brand-name">paeleap</span>
    </div>
  );
}

function SafetyBadge({ status, language }) {
  if (!status || status === "allowed") return null;
  return (
    <span className={`safety-badge safety-${status}`}>
      <Icon name="shield" size={14} />
      {SAFETY_LABELS[language][status]}
    </span>
  );
}

function Message({ message, language, copied, onCopy }) {
  const t = text[language];
  const assistant = message.role === "assistant";
  return (
    <article className={`message-row ${assistant ? "assistant-row" : "user-row"}`}>
      {assistant && <div className="assistant-avatar" aria-hidden="true">旅</div>}
      <div className="message-column">
        <div className={`message-bubble ${assistant ? "assistant-bubble" : "user-bubble"}`}>
          <p>{message.content}</p>
        </div>
          <div className="message-meta">
            {message.createdAt && <time className="message-time" dateTime={message.createdAt}
              title={new Date(message.createdAt).toLocaleString(language === "zh" ? "zh-CN" : "en-US")}>
              {new Intl.DateTimeFormat(language === "zh" ? "zh-CN" : "en-US", { hour: "2-digit", minute: "2-digit" }).format(new Date(message.createdAt))}
            </time>}
            {assistant && <SafetyBadge status={message.safety} language={language} />}
            {message.safety === "allowed" && message.sources?.length > 0 && (
              <span className="grounded-label"><Icon name="shield" size={14} />{SAFETY_LABELS[language].allowed}</span>
            )}
            {assistant && <button className="copy-button" type="button" onClick={() => onCopy(message)} aria-label={t.copy}>
              <Icon name="copy" size={14} />{copied === message.id ? t.copied : t.copy}
            </button>}
          </div>
        {assistant && message.sources?.length > 0 && (
          <div className="sources-card">
            <p><Icon name="link" size={15} />{t.sourceTitle}</p>
            <div className="source-links">
              {message.sources.map((source) => (
                <a key={`${source.name}-${source.url}`} href={source.url} target="_blank" rel="noreferrer">
                  {source.name}<span aria-hidden="true">↗</span>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </article>
  );
}

export default function ChatShell() {
  const [language, setLanguage] = useState("en");
  const [service, setService] = useState({ state: "loading", data: null });
  const [statusAttempt, setStatusAttempt] = useState(0);
  const [authClient, setAuthClient] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [session, setSession] = useState(null);
  const [copied, setCopied] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const endRef = useRef(null);
  const textareaRef = useRef(null);
  const requestsRef = useRef(new Map());
  const sidebarRef = useRef(null);
  const historyButtonRef = useRef(null);
  const t = text[language];

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("paeleap.language");
      if (saved === "zh") setLanguage("zh");
    } catch { /* The chat can run when browser storage is disabled. */ }
  }, []);

  useEffect(() => {
    try { window.localStorage.setItem("paeleap.language", language); } catch { /* Optional preference. */ }
    document.documentElement.lang = language === "zh" ? "zh-CN" : "en";
  }, [language]);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const timeout = window.setTimeout(() => controller.abort(), 10000);
    setService({ state: "loading", data: null });
    fetch("/api/status", { cache: "no-store", signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("Status unavailable");
        return response.json();
      })
      .then((data) => {
        if (data?.service !== "paeleap-tourism-ai") throw new Error("Invalid service status");
        if (active) setService({ state: "ready", data });
      })
      .catch(() => {
        if (active) setService({ state: "error", data: null });
      })
      .finally(() => window.clearTimeout(timeout));
    return () => { active = false; window.clearTimeout(timeout); controller.abort(); };
  }, [statusAttempt]);

  useEffect(() => {
    let active = true;
    let client;
    try { client = getSupabaseBrowserClient(); } catch { client = null; }
    setAuthClient(client);
    if (!client) {
      setAuthReady(true);
      return undefined;
    }
    client.auth.getSession()
      .then(({ data }) => { if (active) setSession(data.session || null); })
      .catch(() => { if (active) setSession(null); })
      .finally(() => { if (active) setAuthReady(true); });
    const { data: listener } = client.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession || null);
      setAuthReady(true);
    });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, []);

  const demoMode = service.data?.localDemoMode === true;
  const chatIdentity = demoMode ? "demo" : session?.user?.id || null;
  const history = useTripHistory(chatIdentity, authClient);
  const { trips, activeTrip } = history;
  const messages = activeTrip?.messages || [];
  const draft = activeTrip?.draft || "";
  const error = activeTrip?.error || "";
  const pending = activeTrip?.pending === true;
  const historyUnavailable = activeTrip?.loaded === false;

  useEffect(() => () => {
    for (const controller of requestsRef.current.values()) controller.abort();
    requestsRef.current.clear();
  }, [chatIdentity]);

  useEffect(() => {
    if (!sidebarOpen) return undefined;
    const media = window.matchMedia("(max-width: 720px)");
    const onResize = () => { if (!media.matches) setSidebarOpen(false); };
    const onKeyDown = (event) => {
      if (event.key === "Escape") { setSidebarOpen(false); historyButtonRef.current?.focus(); }
      if (event.key === "Tab") {
        const buttons = [...sidebarRef.current.querySelectorAll("button:not(:disabled)")].filter((button) => button.offsetParent !== null);
        const first = buttons[0]; const last = buttons.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    sidebarRef.current?.querySelector("button:not(:disabled)")?.focus();
    document.addEventListener("keydown", onKeyDown);
    media.addEventListener("change", onResize);
    return () => { document.removeEventListener("keydown", onKeyDown); media.removeEventListener("change", onResize); };
  }, [sidebarOpen]);

  useEffect(() => {
    if (!textareaRef.current) return;
    textareaRef.current.style.height = "auto";
    textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 144)}px`;
    setCopied(null);
  }, [activeTrip?.id]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, pending, activeTrip?.id]);

  function setDraft(value) { if (activeTrip) history.updateTrip(activeTrip.id, { draft: value }); }
  function setError(value) { if (activeTrip) history.updateTrip(activeTrip.id, { error: value }); }

  const statusLabel = useMemo(() => {
    if (service.state === "error") return t.unavailable;
    if (demoMode) return service.data?.aiMockMode === false ? t.localAi : t.localDemo;
    return t.privateSession;
  }, [demoMode, service.state, service.data?.aiMockMode, t]);

  function changeLanguage(nextLanguage) {
    setLanguage(nextLanguage);
    setError("");
  }

  function resetComposerHeight() {
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  }

  function startNewTrip() {
    history.newTrip();
    setSidebarOpen(false);
    requestAnimationFrame(() => textareaRef.current?.focus());
  }

  function selectTrip(id) {
    history.selectTrip(id);
    setSidebarOpen(false);
    requestAnimationFrame(() => textareaRef.current?.focus());
  }

  async function signOut() {
    for (const controller of requestsRef.current.values()) controller.abort();
    requestsRef.current.clear();
    if (authClient) await authClient.auth.signOut();
  }

  async function copyMessage(message) {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(message.id);
      window.setTimeout(() => setCopied(null), 1400);
    } catch {
      setCopied(null);
    }
  }

  function resizeTextarea(event) {
    event.currentTarget.style.height = "auto";
    event.currentTarget.style.height = `${Math.min(event.currentTarget.scrollHeight, 144)}px`;
  }

  function onComposerKeyDown(event) {
    if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return;
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  function chooseSuggestion(prompt) {
    setDraft(prompt);
    setError("");
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
        textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 144)}px`;
      }
    });
  }

  async function submitMessage(event) {
    event.preventDefault();
    const message = draft.trim();
    if (!activeTrip || historyUnavailable || !message || pending || requestsRef.current.has(activeTrip.id) || message.length > MAX_MESSAGE_LENGTH) return;
    const tripId = activeTrip.id;
    const conversationId = activeTrip.conversationId;
    const previousMessages = activeTrip.messages;

    resetComposerHeight();
    const createdAt = new Date().toISOString();
    history.updateTrip(tripId, (trip) => ({ ...trip, draft: "", error: "", pending: true,
      title: trip.title || message.slice(0, 80), updatedAt: createdAt,
      messages: [...trip.messages, { id: makeMessageId("user"), role: "user", content: message, createdAt }] }));

    const controller = new AbortController();
    requestsRef.current.set(tripId, controller);
    let timedOut = false;
    const timeout = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 90000);

    try {
      let token = null;
      if (!demoMode) {
        const { data } = authClient ? await authClient.auth.getSession() : { data: {} };
        token = data.session?.access_token;
        if (!token) {
          const sessionError = new Error("Missing session");
          sessionError.status = 401;
          throw sessionError;
        }
      }
      const headers = { "Content-Type": "application/json" };
      if (token) headers.Authorization = `Bearer ${token}`;
      controller.signal.throwIfAborted();
      const response = await fetch("/api/chat", {
        method: "POST",
        headers,
        body: JSON.stringify({ ...buildChatBody({ message, conversationId, language }),
          ...(demoMode ? { history: localHistoryForRequest(previousMessages) } : {}) }),
        signal: controller.signal
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const requestError = new Error(payload.error || "Chat request failed");
        requestError.status = response.status;
        requestError.serverMessage = payload.error;
        throw requestError;
      }
      const parsed = parseChatResponse(payload);
      if (requestsRef.current.get(tripId) !== controller) return;
      const repliedAt = new Date().toISOString();
      history.updateTrip(tripId, (trip) => ({ ...trip, conversationId: parsed.conversationId,
        updatedAt: repliedAt, messages: [...trip.messages, {
        id: makeMessageId("assistant"),
        role: "assistant",
        content: parsed.reply,
        sources: parsed.sources,
        safety: parsed.safety,
        createdAt: repliedAt
      }] }));
    } catch (requestError) {
      if (requestsRef.current.get(tripId) !== controller) return;
      const status = timedOut ? 504 : requestError.status;
      if (requestError.name === "AbortError" && !timedOut) {
        history.updateTrip(tripId, { error: language === "zh" ? "已停止生成回复。" : "Response stopped." });
      } else {
        history.updateTrip(tripId, { error: chatErrorMessage(status, language, requestError.serverMessage) });
      }
      if (status === 401 && authClient) await authClient.auth.signOut();
      if (status === 404) history.updateTrip(tripId, { conversationId: null });
    } finally {
      window.clearTimeout(timeout);
      if (requestsRef.current.get(tripId) === controller) {
        requestsRef.current.delete(tripId);
        history.updateTrip(tripId, { pending: false });
      }
    }
  }

  function stopResponse() {
    requestsRef.current.get(activeTrip?.id)?.abort();
  }

  const showLoading = service.state === "loading" || (!demoMode && !authReady) || (chatIdentity && !history.ready);
  const needsAuthentication = !demoMode && authReady && !session;

  return (
    <div className="app-shell grid min-h-dvh grid-cols-[288px_minmax(0,1fr)] max-[900px]:grid-cols-[235px_minmax(0,1fr)] max-[720px]:block">
      {sidebarOpen && <button className="sidebar-backdrop" type="button" aria-label={t.closeTrips} onClick={() => { setSidebarOpen(false); historyButtonRef.current?.focus(); }} />}
      <aside id="trips-sidebar" ref={sidebarRef} className={`sidebar ${sidebarOpen ? "is-open" : ""}`} aria-label={t.tripNavigation}>
        <div className="sidebar-brand-row">
          <div>
          <Brand />
          <p className="brand-tag">{t.brandTag}</p>
          </div>
          <button className="sidebar-close" type="button" aria-label={t.closeTrips} onClick={() => { setSidebarOpen(false); historyButtonRef.current?.focus(); }}><Icon name="close" size={20} /></button>
        </div>
        <button className="new-trip-button" type="button" onClick={startNewTrip} disabled={!history.ready}>
          <Icon name="plus" size={19} />{t.newTrip}
        </button>
        <nav className="trip-list" aria-label={t.tripNavigation}>
          <p className="sidebar-label">{t.recent}</p>
          <div className="trip-scroll">
          {trips.map((trip) => <button key={trip.id} type="button" data-trip-id={trip.id}
            className={`trip-item ${activeTrip?.id === trip.id ? "active" : ""}`}
            aria-pressed={activeTrip?.id === trip.id} onClick={() => selectTrip(trip.id)}>
            <span className="trip-icon" aria-hidden="true"><Icon name="spark" size={17} /></span>
            <span className="trip-description">
              <strong>{trip.title || t.untitledTrip}</strong>
              <small>
                {new Intl.DateTimeFormat(language === "zh" ? "zh-CN" : "en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(trip.updatedAt))}
                {trip.pending && <span className="trip-pending" aria-label={t.thinking}> ···</span>}
              </small>
            </span>
          </button>)}
          </div>
        </nav>
        <div className="sidebar-spacer" />
        <div className="trust-card">
          <span className="trust-icon"><Icon name="shield" size={18} /></span>
          <div><strong>{t.trustTitle}</strong><p>{t.trustBody}</p></div>
        </div>
        <p className="sidebar-disclaimer">{t.disclaimer}</p>
      </aside>

      <main className="main-panel min-w-0" inert={sidebarOpen ? true : undefined}>
        <header className="topbar">
          <div className="mobile-brand"><Brand /></div>
          <button className="mobile-history" ref={historyButtonRef} type="button" aria-label={t.openTrips}
            aria-expanded={sidebarOpen} aria-controls="trips-sidebar" onClick={() => setSidebarOpen(true)}><Icon name="menu" size={19} /></button>
          <button className="mobile-new-trip" type="button" onClick={startNewTrip} disabled={!history.ready} aria-label={t.newTrip}>
            <Icon name="plus" size={19} />
          </button>
          <div className="service-pill"><span className={`status-dot ${service.state}`} />{statusLabel}</div>
          <div className="topbar-actions">
            <div className="language-toggle" aria-label="Language">
              <button type="button" className={language === "en" ? "active" : ""} onClick={() => changeLanguage("en")} aria-pressed={language === "en"}>EN</button>
              <button type="button" className={language === "zh" ? "active" : ""} onClick={() => changeLanguage("zh")} aria-pressed={language === "zh"}>中文</button>
            </div>
            {!demoMode && session && (
              <button type="button" className="signout-button" onClick={signOut}><Icon name="logout" size={17} /><span>{t.signOut}</span></button>
            )}
          </div>
        </header>

        {showLoading ? (
          <div className="loading-screen" role="status"><span className="loader" /><p>{t.loading}</p></div>
        ) : service.state === "error" ? (
          <section className="auth-wrap" aria-labelledby="connection-title">
            <div className="auth-card">
              <h1 id="connection-title">{t.connectionTitle}</h1>
              <p className="auth-intro">{t.connectionBody}</p>
              <button className="primary-button" type="button" onClick={() => setStatusAttempt((attempt) => attempt + 1)}>{t.retry}</button>
            </div>
          </section>
        ) : needsAuthentication ? (
          <AuthPanel language={language} client={authClient} />
        ) : (
          <div className="chat-layout">
            <section className={`conversation ${messages.length ? "has-messages" : ""}`} aria-label={activeTrip?.title || t.today}>
              {historyUnavailable ? (
                <div className="history-loading" role="status">
                  {!activeTrip.historyError && <span className="loader" />}
                  <p>{activeTrip.historyError ? t.historyError : t.historyLoading}</p>
                  {activeTrip.historyError && <button className="primary-button" type="button" onClick={history.retryMessages}>{t.retry}</button>}
                </div>
              ) : messages.length === 0 ? (
                <div className="welcome-panel">
                  <div className="welcome-seal" aria-hidden="true"><span>旅</span></div>
                  <p className="section-kicker">{t.welcomeKicker}</p>
                  <h1>{t.welcomeTitle}</h1>
                  <p className="welcome-copy">{t.welcomeBody}</p>
                  <div className="suggestion-grid grid grid-cols-3 gap-3 text-left max-[900px]:grid-cols-1">
                    {t.suggestions.map((suggestion, index) => (
                      <button key={suggestion.title} type="button" className="suggestion-card" onClick={() => chooseSuggestion(suggestion.prompt)}>
                        <span className="suggestion-number">0{index + 1}</span>
                        <strong>{suggestion.title}</strong>
                        <span>{suggestion.body}</span>
                        <i aria-hidden="true">→</i>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="message-list" aria-live="polite">
                  {messages.map((message) => <Message key={message.id} message={message} language={language} copied={copied} onCopy={copyMessage} />)}
                  {pending && (
                    <div className="message-row assistant-row" role="status">
                      <div className="assistant-avatar" aria-hidden="true">旅</div>
                      <div className="typing-bubble"><span /><span /><span /><em>{t.thinking}</em></div>
                    </div>
                  )}
                  <div ref={endRef} />
                </div>
              )}
            </section>

            <div className="composer-area">
              {history.storageFailed && <p className="history-notice" role="status">{t.storageError}</p>}
              {history.syncFailed && <div className="history-notice" role="status">{t.syncError} <button type="button" onClick={history.retrySync}>{t.retry}</button></div>}
              {error && (
                <div className="error-banner" role="alert">
                  <span>{error}</span>
                  <button type="button" onClick={() => setError("")} aria-label={t.dismiss}>×</button>
                </div>
              )}
              <form className="composer" onSubmit={submitMessage}>
                <label className="sr-only" htmlFor="chat-message">{t.composerLabel}</label>
                <textarea id="chat-message" ref={textareaRef} rows="1" maxLength={MAX_MESSAGE_LENGTH}
                  placeholder={t.placeholder} value={draft} onChange={(event) => setDraft(event.target.value)}
                  onInput={resizeTextarea} onKeyDown={onComposerKeyDown} disabled={pending || historyUnavailable} />
                <div className="composer-bottom">
                  <span className={`character-count ${draft.length > 1350 ? "near-limit" : ""}`}>{draft.length}/{MAX_MESSAGE_LENGTH}</span>
                  {pending ? (
                    <button className="send-button stop-button" type="button" onClick={stopResponse} aria-label={t.stop}><Icon name="stop" size={18} /></button>
                  ) : (
                    <button className="send-button" type="submit" disabled={!draft.trim() || historyUnavailable} aria-label={t.send}><Icon name="send" size={18} /></button>
                  )}
                </div>
              </form>
              <p className="composer-note"><span>{t.enterHint}</span><span>{t.disclaimer}</span></p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
