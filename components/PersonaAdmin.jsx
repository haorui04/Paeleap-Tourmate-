"use client";

import { useEffect, useRef, useState } from "react";
import AuthPanel from "./AuthPanel.jsx";
import { getSupabaseBrowserClient } from "../lib/client/supabase.js";
import { parsePublicPersona, readPersonaPackage } from "../lib/client/personas.js";

const copy = {
  en: {
    title: "Venue assistants", subtitle: "One identity. One knowledge collection. A consistent visitor experience.",
    back: "Open visitor chat", signOut: "Sign out", loading: "Checking administrator access…", retry: "Retry access check",
    forbidden: "This account is not authorized to manage personas. Ask the application owner to grant administrator access.",
    unavailable: "Administration is unavailable. Check the server configuration and try again.",
    upload: "Publish a persona package", uploadBody: "Choose the versioned JSON package containing the persona and its knowledge records. Review the preview before publishing.",
    choose: "Persona + knowledge (.json, maximum 2 MB)", publish: "Publish reviewed package", publishing: "Publishing…",
    success: "The profile was published. Open its visitor link to verify the new version.",
    profiles: "Published profiles", empty: "No profiles are available.", version: "Version", records: "knowledge records",
    platformBank: "Built-in profile · separate 100-FAQ travel bank",
    identity: "Identity", venue: "Venue", tone: "Tone", scope: "Allowed scope", review: "Review before publishing",
    rules: "Platform safety rules cannot be changed by a persona package. Knowledge links are reference metadata, not automatic web crawls. Never upload credentials, visitor transcripts, or private personal information.",
    confirm: "I have reviewed the persona, knowledge accuracy, source permissions, and scope. This package is ready to publish.",
    pending: "No package selected", privacy: "Files are held in this page's memory until you publish or leave. Publishing requires server-verified administrator permission.",
    error: "Publishing failed. No success has been confirmed. Check the package and retry."
  },
  zh: {
    title: "场馆导览助手", subtitle: "独立角色、独立知识资料，为每个场馆提供一致的参观体验。",
    back: "打开访客聊天", signOut: "退出登录", loading: "正在验证管理员权限…", retry: "重新验证权限",
    forbidden: "当前账户无权管理角色，请联系应用负责人授予管理员权限。",
    unavailable: "管理服务暂不可用，请检查服务端配置后重试。",
    upload: "发布角色资料包", uploadBody: "选择包含角色与知识记录的版本化 JSON 文件，核对预览后再发布。",
    choose: "角色与知识文件（.json，最大 2 MB）", publish: "发布已审核的资料包", publishing: "正在发布…",
    success: "角色配置已发布，请打开对应访客链接验证新版本。",
    profiles: "已发布的角色", empty: "暂无可用角色。", version: "版本", records: "条知识记录",
    platformBank: "内置角色 · 独立的100题旅游知识库",
    identity: "角色名称", venue: "所属场馆", tone: "语气", scope: "服务范围", review: "发布前审核",
    rules: "角色资料包不能覆盖平台安全规则。知识链接仅作为参考资料元数据，不会自动抓取网页。请勿上传密钥、访客对话或个人隐私资料。",
    confirm: "我已审核角色、知识准确性、资料使用权限和服务范围，确认可以发布。",
    pending: "尚未选择资料包", privacy: "发布前，文件仅保存在当前页面内存中。发布必须通过服务端管理员权限验证。",
    error: "发布失败，尚未确认成功。请检查资料包后重试。"
  }
};

export default function PersonaAdmin() {
  const [language, setLanguage] = useState("en");
  const [client, setClient] = useState(null);
  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [access, setAccess] = useState("loading");
  const [profiles, setProfiles] = useState([]);
  const [attempt, setAttempt] = useState(0);
  const [preview, setPreview] = useState(null);
  const [reviewed, setReviewed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const selectionRef = useRef(0);
  const fileRef = useRef(null);
  const t = copy[language];

  useEffect(() => {
    let active = true;
    let auth;
    try { auth = getSupabaseBrowserClient(); } catch { auth = null; }
    setClient(auth);
    if (!auth) { setAuthReady(true); return undefined; }
    auth.auth.getSession().then(({ data }) => { if (active) setSession(data.session || null); })
      .catch(() => { if (active) setSession(null); }).finally(() => { if (active) setAuthReady(true); });
    const { data: subscription } = auth.auth.onAuthStateChange((_event, next) => {
      if (active) { setSession(next || null); setAuthReady(true); }
    });
    return () => { active = false; subscription.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    setPreview(null); setReviewed(false); setMessage("");
    selectionRef.current += 1;
    if (fileRef.current) fileRef.current.value = "";
  }, [session?.user?.id]);

  useEffect(() => {
    if (!client || !session) { setProfiles([]); return undefined; }
    let active = true;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15000);
    setAccess("loading");
    (async () => {
      const { data } = await client.auth.getSession();
      if (!data.session?.access_token) throw new Error("expired");
      const response = await fetch("/api/admin/personas", { cache: "no-store", headers: { Authorization: `Bearer ${data.session.access_token}` }, signal: controller.signal });
      if (!response.ok) {
        if (active) { setProfiles([]); setAccess([401, 403].includes(response.status) ? "forbidden" : "error"); }
        return;
      }
      const payload = await response.json();
      if (!Array.isArray(payload.personas)) throw new Error("Invalid profile listing");
      const parsed = payload.personas.map((record) => ({ ...parsePublicPersona(record), recordCount: Array.isArray(record.knowledge) ? record.knowledge.length : 0 }));
      if (active) { setProfiles(parsed); setAccess("ready"); }
    })().catch(() => { if (active) { setProfiles([]); setAccess("error"); } }).finally(() => window.clearTimeout(timeout));
    return () => { active = false; controller.abort(); window.clearTimeout(timeout); };
  }, [client, session?.user?.id, attempt]);

  async function selectFile(event) {
    const file = event.target.files?.[0];
    const selection = ++selectionRef.current;
    setPreview(null); setReviewed(false); setMessage(""); setSuccess(false);
    if (!file) return;
    try {
      const next = await readPersonaPackage(file);
      if (selection === selectionRef.current) setPreview(next);
    } catch (error) { if (selection === selectionRef.current) setMessage(error.message); }
  }

  async function publish(event) {
    event.preventDefault();
    if (!client || !preview || !reviewed || busy || access !== "ready") return;
    setBusy(true); setMessage(""); setSuccess(false);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 30000);
    try {
      const { data } = await client.auth.getSession();
      if (!data.session?.access_token) throw new Error(t.forbidden);
      const response = await fetch("/api/admin/personas", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session.access_token}` },
        body: JSON.stringify(preview.payload), signal: controller.signal });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        if ([401, 403].includes(response.status)) setAccess("forbidden");
        const serverMessage = typeof payload.error === "string" ? payload.error : payload.error?.message;
        const detail = typeof serverMessage === "string" ? serverMessage.slice(0, 500) : t.error;
        throw new Error(detail);
      }
      setMessage(t.success); setSuccess(true); setPreview(null); setReviewed(false);
      if (fileRef.current) fileRef.current.value = "";
      setAttempt((value) => value + 1);
    } catch (error) { setMessage(error.name === "AbortError" ? t.error : error.message || t.error); }
    finally { window.clearTimeout(timeout); setBusy(false); }
  }

  async function signOut() {
    selectionRef.current += 1;
    setPreview(null); setProfiles([]); setReviewed(false);
    await client?.auth.signOut();
  }

  return (
    <main className="admin-shell">
      <header className="admin-topbar">
        <a className="admin-wordmark" href="/">paeleap <span>/ studio</span></a>
        <div className="admin-topbar-actions">
          <div className="language-toggle" aria-label="Language">
            <button type="button" aria-pressed={language === "en"} className={language === "en" ? "active" : ""} onClick={() => setLanguage("en")}>EN</button>
            <button type="button" aria-pressed={language === "zh"} className={language === "zh" ? "active" : ""} onClick={() => setLanguage("zh")}>中文</button>
          </div>
          {session && <button className="admin-text-button" type="button" onClick={signOut} disabled={busy}>{t.signOut}</button>}
        </div>
      </header>
      {!authReady ? <div className="loading-screen" role="status"><span className="loader" /><p>{t.loading}</p></div>
        : !session ? <AuthPanel client={client} language={language} administrator />
          : <div className="admin-content">
            <div className="admin-heading"><p className="section-kicker">PERSONA & KNOWLEDGE</p><h1>{t.title}</h1><p>{t.subtitle}</p></div>
            {access === "loading" ? <p role="status">{t.loading}</p>
              : access !== "ready" ? <section className="admin-card"><p role="alert">{access === "forbidden" ? t.forbidden : t.unavailable}</p><button type="button" className="primary-button" onClick={() => setAttempt((value) => value + 1)}>{t.retry}</button></section>
                : <div className="admin-grid">
                  <section className="admin-card" aria-labelledby="admin-upload-title">
                    <p className="section-kicker">01 / CONFIGURE</p><h2 id="admin-upload-title">{t.upload}</h2><p className="admin-description">{t.uploadBody}</p>
                    <form onSubmit={publish} className="admin-form">
                      <label className="admin-file-label" htmlFor="persona-package">{t.choose}</label>
                      <input ref={fileRef} type="file" id="persona-package" accept="application/json,.json" onChange={selectFile} disabled={busy} />
                      {preview ? <div className="admin-preview">
                        <h3>{t.review}</h3><dl>
                          <dt>{t.identity}</dt><dd>{preview.persona.name[language]}</dd>
                          <dt>ID</dt><dd><code>{preview.persona.id}</code></dd>
                          <dt>{t.venue}</dt><dd>{preview.persona.venue[language]}</dd>
                          <dt>{t.version}</dt><dd>{preview.persona.version}</dd>
                          <dt>{t.tone}</dt><dd>{preview.persona.tone || "—"}</dd>
                          <dt>{t.records}</dt><dd>{preview.recordCount}</dd>
                          <dt>{t.scope}</dt><dd>{Array.isArray(preview.payload.scope) ? preview.payload.scope.filter((scope) => typeof scope === "string").join(" · ") : "—"}</dd>
                        </dl><p>{preview.persona.greeting[language]}</p>
                      </div> : <p className="admin-empty">{t.pending}</p>}
                      <label className="admin-confirm"><input type="checkbox" checked={reviewed} onChange={(event) => setReviewed(event.target.checked)} disabled={!preview || busy} /><span>{t.confirm}</span></label>
                      {message && <p className={`notice ${success ? "admin-success" : ""}`} role={success ? "status" : "alert"}>{message}</p>}
                      <button className="primary-button" type="submit" disabled={!preview || !reviewed || busy}>{busy ? t.publishing : t.publish}</button>
                    </form><p className="admin-smallprint">{t.privacy}</p>
                  </section>
                  <section className="admin-card" aria-labelledby="admin-profiles-title">
                    <p className="section-kicker">02 / DEPLOY</p><h2 id="admin-profiles-title">{t.profiles}</h2>
                    <ul className="admin-profile-list">{profiles.map((profile) => <li key={profile.id}>
                      <h3>{profile.name[language]}</h3><p>{profile.venue[language]}</p><small>{t.version} {profile.version} · {profile.id === "tourmate" ? t.platformBank : `${profile.recordCount} ${t.records}`}</small>
                      <a href={`/?persona=${encodeURIComponent(profile.id)}`} target="_blank" rel="noreferrer">{t.back} <span aria-hidden="true">↗</span></a>
                    </li>)}</ul>{!profiles.length && <p>{t.empty}</p>}
                    <div className="admin-boundary"><h3>{language === "zh" ? "发布边界" : "Publishing boundary"}</h3><p>{t.rules}</p></div>
                  </section>
                </div>}
          </div>}
    </main>
  );
}
