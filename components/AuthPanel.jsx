"use client";

import { useState } from "react";
import TravelScene from "./TravelScene.jsx";
import MuseumScene from "./MuseumScene.jsx";

const copy = {
  en: {
    eyebrow: "YOUR TRAVEL SPACE",
    title: "Sign in to start planning",
    body: "Your account keeps each conversation private and lets TourMate continue the trip you are planning.",
    email: "Email address",
    password: "Password",
    signIn: "Sign in",
    signingIn: "Signing in…",
    signUp: "Create account",
    creating: "Creating account…",
    newUser: "New to Paeleap?",
    existingUser: "Already have an account?",
    switchSignUp: "Create one",
    switchSignIn: "Sign in instead",
    confirm: "Check your email to confirm your account, then return here to sign in.",
    unavailable: "Sign-in isn't available yet. Please contact the application owner.",
    connectionError: "Sign-in could not be reached. Check your connection and try again."
  },
  zh: {
    eyebrow: "你的旅行空间",
    title: "登录后开始规划",
    body: "登录可保护每次对话的私密性，并让 TourMate 继续你的旅行计划。",
    email: "电子邮箱",
    password: "密码",
    signIn: "登录",
    signingIn: "正在登录…",
    signUp: "创建账户",
    creating: "正在创建…",
    newUser: "第一次使用 Paeleap？",
    existingUser: "已有账户？",
    switchSignUp: "创建账户",
    switchSignIn: "返回登录",
    confirm: "请查看邮箱并确认账户，然后返回此处登录。",
    unavailable: "登录暂不可用，请联系应用管理员。",
    connectionError: "无法连接到登录服务，请检查网络后重试。"
  }
};

export default function AuthPanel({ language, client, administrator = false, museum = false }) {
  const t = museum ? { ...(copy[language] || copy.en), ...(language === "zh" ? {
    eyebrow: "你的博物馆探索空间", title: "登录后开始探索", body: "保存你的博物馆对话，与 Tourmate 小德兔一起理解文物与历史。"
  } : { eyebrow: "YOUR MUSEUM SPACE", title: "Sign in to explore", body: "Save your museum conversations and discover artifacts and history with Tourmate's Little De Rabbit." }) } : copy[language] || copy.en;
  const [mode, setMode] = useState("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event) {
    event.preventDefault();
    if (!client || busy) return;
    setBusy(true);
    setMessage("");
    try {
      const credentials = { email: email.trim(), password };
      const result = mode === "signIn"
        ? await client.auth.signInWithPassword(credentials)
        : await client.auth.signUp(credentials);
      if (result.error) { setMessage(result.error.message); return; }
      if (mode === "signUp" && !result.data.session) setMessage(t.confirm);
    } catch {
      setMessage(t.connectionError);
    } finally {
      setBusy(false);
    }
  }

  function switchMode() {
    setMode((current) => current === "signIn" ? "signUp" : "signIn");
    setMessage("");
  }

  return (
    <section className={`auth-wrap ${administrator ? "" : "auth-landing"}`} aria-labelledby="auth-title">
      {!administrator && <div className="auth-promo">
        <p className="section-kicker">{museum ? "TOURMATE · LITTLE DE RABBIT" : language === "zh" ? "下一段旅程，从这里开始" : "EVERY GREAT JOURNEY STARTS SOMEWHERE"}</p>
        <h2>{museum ? language === "zh" ? <>一件文物，<br/><span>一段历史。</span></> : <>Every artifact.<br/><span>A story to discover.</span></> : language === "zh" ? <>心有所向，<br/><span>行有所伴。</span></> : <>Go somewhere new.<br/><span>Feel right at home.</span></>}</h2>
        <p>{museum ? language === "zh" ? "和小德兔一起探索德寿宫，认识展品、看懂遗址，让历史更容易理解。独立 AI 导览，非馆方官方服务。" : "Explore Deshou Palace with Little De Rabbit. Understand the objects, read the ruins, and discover their stories. An independent AI guide, not an official museum service." : language === "zh" ? "从第一段车程到下一处风景，让你的 AI 中国旅行伙伴陪你从容探索。" : "From your first train ride to your next favourite place. Your AI companion makes exploring China feel a little more familiar."}</p>
        {museum ? <MuseumScene/> : <TravelScene/>}
        <span className="auth-promo-footnote">{museum ? language === "zh" ? "文物讲解 · 遗址探索 · 历史文化" : "Artifact explanations · Archaeological remains · Cultural context" : language === "zh" ? "旅行建议 · 文化探索 · 实时天气" : "Travel guidance · Cultural discoveries · Live weather"}</span>
      </div>}
      <div className="auth-card">
        <div className="auth-mark" aria-hidden="true">{museum ? "兔" : "旅"}</div>
        <p className="section-kicker">{administrator ? (language === "zh" ? "管理员工作台" : "ADMINISTRATOR WORKSPACE") : t.eyebrow}</p>
        <h1 id="auth-title">{administrator ? (language === "zh" ? "管理员登录" : "Administrator sign-in") : t.title}</h1>
        <p className="auth-intro">{administrator ? (language === "zh" ? "请使用已被授权管理场馆资料的账户。普通访客账户没有发布权限。" : "Use an account authorized to manage venue profiles. Visitor accounts do not have publishing access.") : t.body}</p>

        {!client ? (
          <div className="notice notice-warning" role="status">{t.unavailable}</div>
        ) : (
          <form className="auth-form" onSubmit={submit}>
            <label>
              <span>{t.email}</span>
              <input type="email" name="email" autoComplete="email" value={email}
                onChange={(event) => setEmail(event.target.value)} required />
            </label>
            <label>
              <span>{t.password}</span>
              <input type="password" name="password"
                autoComplete={mode === "signIn" ? "current-password" : "new-password"}
                minLength={6} value={password}
                onChange={(event) => setPassword(event.target.value)} required />
            </label>
            {message && <div className="notice" role="status">{message}</div>}
            <button className="primary-button" type="submit" disabled={busy}>
              {mode === "signIn" ? (busy ? t.signingIn : t.signIn) : (busy ? t.creating : t.signUp)}
            </button>
          </form>
        )}

        {client && !administrator && (
          <p className="auth-switch">
            {mode === "signIn" ? t.newUser : t.existingUser}{" "}
            <button type="button" onClick={switchMode} disabled={busy}>
              {mode === "signIn" ? t.switchSignUp : t.switchSignIn}
            </button>
          </p>
        )}
      </div>
    </section>
  );
}
