"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import AuthPanel from "./AuthPanel.jsx";
import useTripHistory from "./useTripHistory.js";
import TravelScene from "./TravelScene.jsx";
import MuseumScene from "./MuseumScene.jsx";
import DeleteChatDialog from "./DeleteChatDialog.jsx";
import ThinkingIndicator from "./ThinkingIndicator.jsx";
import AttachmentPicker from "./AttachmentPicker.jsx";
import { attachmentPrompt, attachmentTranscript, MAX_ATTACHMENT_MESSAGE } from '../lib/attachments/shared.js';
import { compactWeatherView } from "../lib/weather-format.js";
import { getSupabaseBrowserClient } from "../lib/client/supabase.js";
import { localHistoryForRequest, createRemoteTrip } from "../lib/client/trips.js";
import { DEFAULT_PERSONA_ID, parsePublicPersona, personaIdFromSearch, provenanceLabel } from "../lib/client/personas.js";
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
    trustTitle: "A companion you can count on",
    trustBody: "Thoughtful guidance. Clear references. A little more confidence on your journey.",
    disclaimer: "AI can make mistakes. Confirm live hours, prices and transport with official providers.",
    signOut: "Sign out",
    localDemo: "Offline FAQ mode",
    localAi: "Local AI",
    privateSession: "Your personal travel space",
    unavailable: "Status unavailable",
    connectionTitle: "Let's reconnect",
    connectionBody: "TourMate couldn't reach the chat service. Check your connection and try again.",
    retry: "Try again",
    welcomeKicker: "MADE FOR YOUR NEXT CHAPTER",
    welcomeTitle: "A little guidance.",
    welcomeAccent: "A world to explore.",
    welcomeBody: "Your AI companion for travelling in China. Find your way, discover somewhere new, and make every journey feel a little easier.",
    starterTitle: "A good place to start",
    starterHint: "Choose an idea, or ask your own question below.",
    deleteChat: "Delete conversation",
    deleteWait: "Wait for this response to finish before deleting",
    deleteError: "We couldn't delete this conversation. Your history is still saved. Check your connection and try again.",
    deleted: "Conversation deleted",
    composerLabel: "Ask TourMate",
    placeholder: "Ask about travel in China…",
    send: "Send message",
    stop: "Stop response",
    enterHint: "Enter to send · Shift + Enter for a new line",
    sourceTitle: "Reference links",
    faqLabel: "Travel FAQ",
    copied: "Copied",
    copy: "Copy response",
    dismiss: "Dismiss",
    thinking: "Looking through the travel notes",
    loading: "Preparing your travel space…",
    profileError: "This assistant profile could not be loaded. Check the museum link or try again.",
    profileTitle: "Assistant unavailable",
    profileVersion: "Profile version",
    today: "Current conversation",
    suggestions: [
      { title: "Getting around", body: "Book a train with your passport", prompt: "How do I book a train ticket in China?" },
      { title: "Pay with confidence", body: "Learn about visitor payments", prompt: "Can foreign tourists use Alipay?" },
      { title: "Discover somewhere new", body: "Explore the story of West Lake", prompt: "What is West Lake and why is it culturally significant?" },
      { title: "Check the forecast", body: "Current city weather, before you go", prompt: "What is the weather in Beijing now?" }
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
    trustTitle: "安心出行，一路相伴",
    trustBody: "用心的建议、清晰的参考，让每一步旅程多一份从容。",
    disclaimer: "AI 可能出错。实时开放时间、票价和交通信息请以官方渠道为准。",
    signOut: "退出登录",
    localDemo: "离线问答模式",
    localAi: "本地 AI",
    privateSession: "你的专属旅行空间",
    unavailable: "状态不可用",
    connectionTitle: "请重新连接",
    connectionBody: "无法连接到聊天服务，请检查网络后重试。",
    retry: "重试",
    welcomeKicker: "下一段旅程，从这里开始",
    welcomeTitle: "用心指引，",
    welcomeAccent: "自在探索。",
    welcomeBody: "你的 AI 中国旅行伙伴。轻松规划出行、发现新的风景，让每一段旅程更从容。",
    starterTitle: "从一个好问题开始",
    starterHint: "选一个灵感，或在下方提出你的问题。",
    deleteChat: "删除对话",
    deleteWait: "请等待当前回复结束后再删除",
    deleteError: "未能删除此对话，历史记录仍已保留。请检查网络后重试。",
    deleted: "对话已删除",
    composerLabel: "询问 TourMate",
    placeholder: "询问中国旅游相关问题…",
    send: "发送消息",
    stop: "停止回复",
    enterHint: "按 Enter 发送 · Shift + Enter 换行",
    sourceTitle: "参考资料链接",
    faqLabel: "旅游问答",
    copied: "已复制",
    copy: "复制回复",
    dismiss: "关闭",
    thinking: "正在查阅旅行资料",
    loading: "正在准备你的旅行空间…",
    profileError: "无法加载此助手配置，请检查场馆链接或重试。",
    profileTitle: "助手暂不可用",
    profileVersion: "配置版本",
    today: "当前对话",
    suggestions: [
      { title: "轻松出行", body: "了解如何使用护照购买火车票", prompt: "在中国如何预订火车票？" },
      { title: "安心支付", body: "了解游客支付方式", prompt: "外国游客可以使用支付宝吗？" },
      { title: "发现新的风景", body: "探索西湖的文化故事", prompt: "西湖是什么，为什么具有文化意义？" },
      { title: "出行先看天气", body: "查看目的地的最新天气", prompt: "北京现在的天气怎么样？" }
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
  if (name === "trash") return <svg {...common}><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7" /></svg>;
  if (name === "compass") return <svg {...common}><circle cx="12" cy="12" r="9"/><path d="m16 8-2.5 5.5L8 16l2.5-5.5L16 8Z"/></svg>;
  if (name === "cloud") return <svg {...common}><path d="M7 18h10a4 4 0 0 0 .8-7.9A6 6 0 0 0 6.2 9a4.5 4.5 0 0 0 .8 9Z"/></svg>;
  if (name === "train") return <svg {...common}><rect x="5" y="3" width="14" height="16" rx="4"/><path d="M5 10h14M9 3v7M8 22l2-3M16 22l-2-3M8 15h1M15 15h1"/></svg>;
  return null;
}

function Brand({ name = "paeleap", avatar = "旅" }) {
  return (
    <div className="brand" aria-label={name}>
      <span className="brand-symbol" aria-hidden="true"><span>{avatar}</span></span>
      <span className="brand-name">{name}</span>
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

function Message({ message, language, copied, onCopy, avatar }) {
  const t = text[language];
  const assistant = message.role === "assistant";
  const weatherView = assistant ? compactWeatherView(message.content) : null;
  return (
    <article className={`message-row ${assistant ? "assistant-row" : "user-row"} ${message.fresh ? "message-fresh" : ""}`}>
      {assistant && <div className="assistant-avatar" aria-hidden="true">{avatar}</div>}
      <div className="message-column">
        {assistant && <span className="message-author">{message.persona?.name?.[language] || (language === "zh" ? "你的旅行伙伴" : "Your travel companion")}</span>}
        <div className={`message-bubble ${assistant ? "assistant-bubble" : "user-bubble"}`}>
          <p>{weatherView?.text || message.content}</p>
        </div>
          <div className="message-meta">
            {message.createdAt && <time className="message-time" dateTime={message.createdAt}
              title={new Date(message.createdAt).toLocaleString(language === "zh" ? "zh-CN" : "en-US")}>
              {new Intl.DateTimeFormat(language === "zh" ? "zh-CN" : "en-US", { hour: "2-digit", minute: "2-digit" }).format(new Date(message.createdAt))}
            </time>}
            {assistant && <SafetyBadge status={message.safety} language={language} />}
            {assistant && message.faq && <span className="grounded-label" title={message.faq.question}>{t.faqLabel} · {message.faq.id}</span>}
            {assistant && message.safety === "allowed" && provenanceLabel(message.ai?.mode, language) && (
              <span className="grounded-label">{provenanceLabel(message.ai.mode, language)}</span>
            )}
            {assistant && <button className="copy-button" type="button" onClick={() => onCopy(message)} aria-label={t.copy}>
              <Icon name="copy" size={14} />{copied === message.id ? t.copied : t.copy}
            </button>}
          </div>
        {weatherView && <details className="weather-credit"><summary>{language === "zh" ? "天气来源" : "Weather sources"}</summary>
          {weatherView.sources.map(source => <a key={source.url} href={source.url} target="_blank" rel="noreferrer">{source.name}</a>)}
        </details>}
        {assistant && !weatherView && message.sources?.length > 0 && (
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
  const [personaId, setPersonaId] = useState(null);
  const [profile, setProfile] = useState({ state: "loading", data: null });
  const [authClient, setAuthClient] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [session, setSession] = useState(null);
  const [copied, setCopied] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteError, setDeleteError] = useState("");
  const [announcement, setAnnouncement] = useState("");
  // Raw files are deliberately excluded from persistent trip/localStorage state.
  const [attachmentDrafts, setAttachmentDrafts] = useState({});
  const [attachmentBusy, setAttachmentBusy] = useState(false);
  const endRef = useRef(null);
  const textareaRef = useRef(null);
  const requestsRef = useRef(new Map());
  const sidebarRef = useRef(null);
  const historyButtonRef = useRef(null);
  const persona = profile.data;
  const museum = persona?.id !== DEFAULT_PERSONA_ID;
  const t = useMemo(() => museum ? { ...text[language], ...(language === "zh" ? {
    brandTag: "TOURMATE · 博物馆 AI 导览", newTrip: "新对话", recent: "博物馆对话", untitledTrip: "新对话",
    tripNavigation: "已保存对话", openTrips: "打开对话列表", closeTrips: "关闭对话列表",
    syncError: "无法同步已保存对话，本地记录仍可使用。", emptyTrip: "从一件展品开始探索",
    trustTitle: "看见文物，读懂历史", trustBody: "清楚区分文物、遗址与复原展示，让每次探索有据可循。",
    disclaimer: "独立 AI 导览，并非馆方官方服务。AI 可能出错；当前在展、参观安排以馆方公告为准。",
    privateSession: "你的博物馆探索空间", thinking: "正在查阅展品与历史资料", loading: "正在准备博物馆导览…", faqLabel: "博物馆资料"
  } : {
    brandTag: "TOURMATE · AI MUSEUM COMPANION", newTrip: "New conversation", recent: "MUSEUM CONVERSATIONS", untitledTrip: "New conversation",
    tripNavigation: "Saved conversations", openTrips: "Open conversations", closeTrips: "Close conversations",
    syncError: "Saved conversations couldn't be synced. Your local chats are still available.", emptyTrip: "Begin with an artifact",
    trustTitle: "Objects with a story", trustBody: "Clear references. Thoughtful explanations. Original remains and reconstructions, clearly distinguished.",
    disclaimer: "Independent AI guide, not an official museum service. AI can make mistakes; confirm current displays and visiting arrangements with the museum.",
    privateSession: "Your museum exploration space", thinking: "Exploring the museum references", loading: "Preparing your museum guide…", faqLabel: "Museum reference"
  }) } : text[language], [language, museum]);
  const personaName = persona?.name[language] || "Paeleap";
  const avatar = persona?.id === "little-de-rabbit" ? "兔" : persona?.id === DEFAULT_PERSONA_ID ? "旅" : Array.from(personaName)[0];
  const personaReady = profile.state === "ready";

  useEffect(() => {
    function selectPersona() {
      try { setPersonaId(personaIdFromSearch(window.location.search)); }
      catch { setPersonaId(null); setProfile({ state: "error", data: null }); }
    }
    selectPersona();
    window.addEventListener("popstate", selectPersona);
    return () => window.removeEventListener("popstate", selectPersona);
  }, []);

  useEffect(() => {
    if (!personaId) return undefined;
    const controller = new AbortController();
    let active = true;
    const timeout = window.setTimeout(() => controller.abort(), 10000);
    setProfile({ state: "loading", data: null });
    fetch(`/api/personas?id=${encodeURIComponent(personaId)}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Assistant unavailable");
        const payload = await response.json();
        const next = parsePublicPersona(payload.persona);
        if (next.id !== personaId) throw new Error("Mismatched assistant profile");
        if (active) setProfile({ state: "ready", data: next });
      })
      .catch(() => { if (active) setProfile({ state: "error", data: null }); })
      .finally(() => window.clearTimeout(timeout));
    return () => { active = false; window.clearTimeout(timeout); controller.abort(); };
  }, [personaId, statusAttempt]);

  useEffect(() => {
    if (persona) document.title = `${persona.name[language]} · ${persona.venue[language]}`;
  }, [persona, language]);

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
  const chatIdentity = !personaReady ? null : demoMode ? "demo" : session?.user?.id || null;
  const history = useTripHistory(chatIdentity, authClient, personaId || DEFAULT_PERSONA_ID);
  const { trips, activeTrip } = history;
  const messages = activeTrip?.messages || [];
  const draft = activeTrip?.draft || "";
  const error = activeTrip?.error || "";
  const pending = activeTrip?.pending === true;
  const historyUnavailable = activeTrip?.loaded === false;
  const attachment = attachmentDrafts[activeTrip?.id] || null;
  const attachmentEnabled = persona?.id === DEFAULT_PERSONA_ID && service.data?.attachmentsConfigured === true;
  const messageLimit = attachment ? MAX_ATTACHMENT_MESSAGE : MAX_MESSAGE_LENGTH;

  useEffect(() => { setDeleteTarget(null); setDeleteError(""); setAnnouncement(""); setAttachmentDrafts({}); }, [chatIdentity, personaId]);
  useEffect(() => { setAttachmentBusy(false); }, [activeTrip?.id,chatIdentity,personaId]);
  useEffect(() => {
    const ids = new Set(trips.map(trip=>trip.id));
    setAttachmentDrafts(previous => Object.keys(previous).some(id=>!ids.has(id)) ? Object.fromEntries(Object.entries(previous).filter(([id])=>ids.has(id))) : previous);
  },[trips]);

  useEffect(() => () => {
    for (const controller of requestsRef.current.values()) controller.abort();
    requestsRef.current.clear();
  }, [chatIdentity, personaId]);

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
    endRef.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "end" });
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

  function closeDeleteDialog() {
    if (history.deletingTripId) return;
    setDeleteTarget(null); setDeleteError("");
    requestAnimationFrame(() => textareaRef.current?.focus());
  }

  async function confirmDelete() {
    setDeleteError("");
    try {
      if (await history.deleteTrip(deleteTarget)) {
        setDeleteTarget(null); setAnnouncement(t.deleted);
        requestAnimationFrame(() => textareaRef.current?.focus());
      }
    } catch { setDeleteError(t.deleteError); }
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
    const message = attachment ? attachmentPrompt(draft,language) : draft.trim();
    if (!personaReady || !activeTrip || historyUnavailable || !message || pending || attachmentBusy || requestsRef.current.has(activeTrip.id) || message.length > messageLimit) return;
    const tripId = activeTrip.id;
    const selectedFile = attachment;
    const userContent = selectedFile ? attachmentTranscript(message,selectedFile.name,language) : message;
    let conversationId = activeTrip.conversationId;
    const previousMessages = activeTrip.messages;

    resetComposerHeight();
    const createdAt = new Date().toISOString();
    history.updateTrip(tripId, (trip) => ({ ...trip, draft: "", error: "", pending: true,
      title: trip.title || message.slice(0, 80), updatedAt: createdAt,
      messages: [...trip.messages, { id: makeMessageId("user"), role: "user", content: userContent, createdAt }] }));

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
        if (!conversationId) {
          // Reserve the conversation before inference, so even a stopped
          // response has a known database ID that the visitor can delete.
          conversationId = crypto.randomUUID();
          history.updateTrip(tripId, { conversationId });
          await createRemoteTrip(authClient, { id: conversationId, userId: data.session.user.id,
            title: message, personaId, personaVersion: persona.version });
        }
      }
      const headers = selectedFile ? {} : { "Content-Type": "application/json" };
      if (token) headers.Authorization = `Bearer ${token}`;
      const fields = buildChatBody({message,conversationId,language,personaId});
      let requestBody;
      if (selectedFile) {
        requestBody = new FormData();
        for (const [key,value] of Object.entries(fields)) if(value != null) requestBody.set(key,String(value));
        requestBody.set('file',selectedFile);
      } else requestBody = JSON.stringify({...fields,...(demoMode ? {history:localHistoryForRequest(previousMessages)} : {})});
      controller.signal.throwIfAborted();
      const response = await fetch("/api/chat", {
        method: "POST",
        headers,
        body: requestBody,
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
      if (parsed.persona && parsed.persona.id !== personaId) throw new Error("Mismatched assistant reply");
      if (requestsRef.current.get(tripId) !== controller) return;
      if (selectedFile) setAttachmentDrafts(previous => {const next={...previous}; delete next[tripId]; return next;});
      const repliedAt = new Date().toISOString();
      history.updateTrip(tripId, (trip) => ({ ...trip, conversationId: parsed.conversationId,
        updatedAt: repliedAt, messages: [...trip.messages, {
        id: makeMessageId("assistant"),
        role: "assistant",
        content: parsed.reply,
        sources: parsed.sources,
        safety: parsed.safety,
        ...(parsed.ai ? { ai: parsed.ai } : {}),
        ...(parsed.persona ? { persona: parsed.persona } : {}),
        ...(parsed.faq ? { faq: parsed.faq } : {}),
        createdAt: repliedAt,
        fresh: true
      }] }));
    } catch (requestError) {
      if (requestsRef.current.get(tripId) !== controller) return;
      if (selectedFile) history.updateTrip(tripId, {draft});
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

  const showLoading = service.state === "loading" || profile.state === "loading" || (!demoMode && !authReady) || (chatIdentity && !history.ready);
  const needsAuthentication = !demoMode && authReady && !session;
  const suggestions = persona?.id === "little-de-rabbit" ? (language === "zh" ? [
    { title: "认识小德兔", body: "了解你的博物馆导览伙伴", prompt: "你是谁，你的角色是什么？" },
    { title: "看懂一件文物", body: "七根花管里藏着什么巧思？", prompt: "龙泉窑青釉六方七管占景盆是什么，有什么用途？" },
    { title: "深入了解", body: "分清宋代原物与现代复原", prompt: "重华殿和两把龙椅是宋代原件吗？" },
    { title: "开始参观", body: "按主题探索德寿宫", prompt: "德寿宫有哪些展区，建议怎么参观？" }
  ] : [
    { title: "Meet Little De Rabbit", body: "Your AI museum companion", prompt: "Who are you and what is your role?" },
    { title: "Discover an artifact", body: "A clever seven-tube flower vessel", prompt: "What is the Longquan seven-tube hexagonal flower vessel?" },
    { title: "Look a little closer", body: "Original objects and reconstructions", prompt: "Are Chonghua Hall and the two thrones original artifacts?" },
    { title: "Explore the museum", body: "A suggested viewing sequence", prompt: "How should I tour the museum and its exhibition areas?" }
  ]) : persona?.id === DEFAULT_PERSONA_ID ? t.suggestions : [
    { title: language === "zh" ? "认识导览助手" : "Meet your guide", body: personaName,
      prompt: language === "zh" ? "你是谁？" : "Who are you?" },
    { title: language === "zh" ? "探索场馆" : "Explore the venue", body: persona?.venue[language] || "",
      prompt: language === "zh" ? `请介绍${persona?.venue.zh || "这个场馆"}。` : `Tell me about ${persona?.venue.en || "this venue"}.` },
    { title: language === "zh" ? "参观帮助" : "Visitor information", body: language === "zh" ? "查阅馆方提供的资料" : "Ask about the venue's visitor guidance",
      prompt: language === "zh" ? "参观这个场馆有哪些需要了解的信息？" : "What should I know before visiting this venue?" }
  ];

  return (
    <div className="app-shell">
      <span className="sr-only" role="status">{announcement}</span>
      <DeleteChatDialog trip={deleteTarget} busy={Boolean(history.deletingTripId)} error={deleteError} language={language} onCancel={closeDeleteDialog} onConfirm={confirmDelete}/>
      {sidebarOpen && <button className="sidebar-backdrop" type="button" aria-label={t.closeTrips} onClick={() => { setSidebarOpen(false); historyButtonRef.current?.focus(); }} />}
      <aside id="trips-sidebar" ref={sidebarRef} className={`sidebar ${sidebarOpen ? "is-open" : ""}`} aria-label={t.tripNavigation}>
        <div className="sidebar-brand-row">
          <div>
          <Brand name={personaName} avatar={avatar} />
          <p className="brand-tag">{t.brandTag}</p>
          {persona && <p className="venue-name">{persona.venue[language]}</p>}
          </div>
          <button className="sidebar-close" type="button" aria-label={t.closeTrips} onClick={() => { setSidebarOpen(false); historyButtonRef.current?.focus(); }}><Icon name="close" size={20} /></button>
        </div>
        <button className="new-trip-button" type="button" onClick={startNewTrip} disabled={!history.ready}>
          <Icon name="plus" size={19} />{t.newTrip}
        </button>
        <nav className="trip-list" aria-label={t.tripNavigation}>
          <p className="sidebar-label">{t.recent}</p>
          <div className="trip-scroll">
          {trips.map((trip) => <div key={trip.id} className={`trip-item ${activeTrip?.id === trip.id ? "active" : ""}`}>
            <button type="button" data-trip-id={trip.id} className="trip-select" aria-pressed={activeTrip?.id === trip.id} onClick={() => selectTrip(trip.id)}>
            <span className="trip-icon" aria-hidden="true"><Icon name="compass" size={18} /></span>
            <span className="trip-description">
              <strong>{trip.title || t.untitledTrip}</strong>
              <small>
                {new Intl.DateTimeFormat(language === "zh" ? "zh-CN" : "en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(trip.updatedAt))}
                {trip.pending && <span className="trip-pending" aria-label={t.thinking}> ···</span>}
              </small>
            </span>
            </button>
            <button type="button" className="trip-delete" aria-label={`${t.deleteChat}: ${trip.title || t.untitledTrip}`}
              title={trip.pending ? t.deleteWait : t.deleteChat} disabled={trip.pending || Boolean(history.deletingTripId)}
              onClick={() => { setSidebarOpen(false); setDeleteError(""); setDeleteTarget(trip); }}><Icon name="trash" size={16}/></button>
          </div>)}
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
          <div className="topbar-heading"><span>{persona?.venue[language] || "Tourmate"}</span><strong>{activeTrip?.title || (museum ? language === "zh" ? "一起读懂德寿宫" : "Discover Deshou Palace" : language === "zh" ? "下一段旅程" : "Your next adventure")}</strong></div>
          <div className="mobile-brand"><Brand name={personaName} avatar={avatar} /></div>
          <button className="mobile-history" ref={historyButtonRef} type="button" aria-label={t.openTrips}
            aria-expanded={sidebarOpen} aria-controls="trips-sidebar" onClick={() => setSidebarOpen(true)}><Icon name="menu" size={19} /></button>
          <button className="mobile-new-trip" type="button" onClick={startNewTrip} disabled={!history.ready} aria-label={t.newTrip}>
            <Icon name="plus" size={19} />
          </button>
          <div className="service-pill"><span className={`status-dot ${service.state}`} />{statusLabel}</div>
          {persona && <span className="profile-identity" title={`${t.profileVersion} ${persona.version}`}>{personaName}</span>}
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
        ) : profile.state === "error" ? (
          <section className="auth-wrap" aria-labelledby="profile-error-title">
            <div className="auth-card">
              <h1 id="profile-error-title">{t.profileTitle}</h1>
              <p className="auth-intro">{t.profileError}</p>
              <button className="primary-button" type="button" onClick={() => setStatusAttempt((attempt) => attempt + 1)}>{t.retry}</button>
            </div>
          </section>
        ) : needsAuthentication ? (
          <AuthPanel language={language} client={authClient} museum={museum} />
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
                  <div className="welcome-hero">
                    <div className="welcome-heading">
                      <p className="section-kicker"><span className="kicker-dot"/>{persona?.id === DEFAULT_PERSONA_ID ? t.welcomeKicker : persona?.venue[language]}</p>
                      <h1>{persona?.id === DEFAULT_PERSONA_ID ? <>{t.welcomeTitle}<br/><span>{t.welcomeAccent}</span></> : personaName}</h1>
                      <p className="welcome-copy">{persona?.id === DEFAULT_PERSONA_ID ? t.welcomeBody : persona?.greeting[language]}</p>
                      <span className="hero-caption"><Icon name="compass" size={15}/>{language === "zh" ? "少一点犹豫，多一点发现" : "Less wondering. More discovering."}</span>
                    </div>
                    {museum ? <MuseumScene/> : <TravelScene/>}
                  </div>
                  <div className="starter-heading"><h2>{t.starterTitle}</h2><p>{t.starterHint}</p></div>
                  <div className="suggestion-grid">
                    {suggestions.map((suggestion, index) => (
                      <button key={suggestion.title} type="button" className="suggestion-card" onClick={() => chooseSuggestion(suggestion.prompt)}>
                        <span className="suggestion-icon"><Icon name={["train", "shield", "compass", "cloud"][index]} size={21}/></span>
                        <strong>{suggestion.title}</strong>
                        <span>{suggestion.body}</span>
                        <i aria-hidden="true">→</i>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="message-list" aria-live="polite">
                  {messages.map((message) => <Message key={message.id} message={message} language={language} copied={copied} onCopy={copyMessage} avatar={avatar} />)}
                  {pending && <ThinkingIndicator key={activeTrip.id} language={language} avatar={avatar} museum={museum}/>}
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
                <label className="sr-only" htmlFor="chat-message">{language === "zh" ? `询问${personaName}` : `Ask ${personaName}`}</label>
                <textarea id="chat-message" ref={textareaRef} rows="1" maxLength={messageLimit}
                  placeholder={persona?.id === DEFAULT_PERSONA_ID ? t.placeholder : language === "zh" ? `向${personaName}询问场馆相关问题…` : `Ask ${personaName} about this venue…`} value={draft} onChange={(event) => setDraft(event.target.value)}
                  onInput={resizeTextarea} onKeyDown={onComposerKeyDown} disabled={!personaReady || pending || historyUnavailable || attachmentBusy} />
                <div className="composer-bottom">
                  {attachmentEnabled && <AttachmentPicker key={`${chatIdentity}-${personaId}-${activeTrip?.id}`} file={attachment} language={language}
                    disabled={pending || attachmentBusy || historyUnavailable} onBusy={setAttachmentBusy} onError={setError}
                    onChange={file=>{if(file && draft.length>MAX_ATTACHMENT_MESSAGE){setError(language==='zh'?'附带文件时，请将问题缩短至 1,300 字符。':'Shorten your question to 1,300 characters when attaching a file.');return;} setAttachmentDrafts(previous=>({...previous,[activeTrip.id]:file}));}}/>}
                  <span className={`character-count ${draft.length > messageLimit-150 ? "near-limit" : ""}`}>{draft.length}/{messageLimit}</span>
                  {pending ? (
                    <button className="send-button stop-button" type="button" onClick={stopResponse} aria-label={t.stop}><Icon name="stop" size={18} /></button>
                  ) : (
                    <button className="send-button" type="submit" disabled={!personaReady || (!draft.trim() && !attachment) || historyUnavailable || attachmentBusy} aria-label={t.send}><Icon name="send" size={18} /></button>
                  )}
                </div>
              </form>
              {attachmentBusy && <p className="attachment-help" role="status">{language==='zh'?'正在准备附件…':'Preparing attachment…'}</p>}
              {attachmentEnabled && <p className="attachment-help">{language==='zh'?'单个文件 · 2 MB · PDF 最多 12 页。由 AI 处理，请勿上传证件或秘密信息。聊天记录不保存原始附件；再次提问细节时请重新上传。':'One file · 2 MB · PDF up to 12 pages. Processed by AI; do not upload IDs or secrets. Original files are not saved in chat history; reattach to ask about details later.'}</p>}
              <p className="composer-note"><span>{t.enterHint}</span><span>{t.disclaimer}</span></p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
