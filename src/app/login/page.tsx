"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Mode = "entrar" | "criar" | "link";

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("entrar");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const supabase = createClient();
  const redirectTo = () => `${window.location.origin}/auth/callback`;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      if (mode === "entrar") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        window.location.href = "/";
        return;
      }
      if (mode === "criar") {
        const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: redirectTo() } });
        if (error) throw error;
        if (data.session) {
          window.location.href = "/";
          return;
        }
        setMsg({ ok: true, text: "Enviamos um e-mail para confirmar o cadastro." });
        return;
      }
      const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo() } });
      if (error) throw error;
      setMsg({ ok: true, text: "Link de acesso enviado. Confira seu e-mail." });
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : "Algo deu errado." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login">
      <div className="card login-card">
        <div className="wordmark" style={{ padding: 0, cursor: "default" }}>
          CAPOVILLA <span>CENTRAL</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <h1 className="h2">{mode === "criar" ? "Criar conta" : "Entrar"}</h1>
          <p className="sub-sm">Acesso exclusivo para apoiadores do canal. Use o mesmo e-mail do seu apoio.</p>
        </div>
        <button
          className="btn btn-md btn-outline"
          onClick={() => supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: redirectTo() } })}
        >
          Continuar com Google
        </button>
        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <input className="field" type="email" required placeholder="E-mail" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="E-mail" />
          {mode !== "link" && (
            <input className="field" type="password" required minLength={6} placeholder="Senha" autoComplete={mode === "criar" ? "new-password" : "current-password"} value={password} onChange={(e) => setPassword(e.target.value)} aria-label="Senha" />
          )}
          <button className="btn btn-md btn-primary" disabled={busy}>
            {mode === "entrar" ? "Entrar" : mode === "criar" ? "Criar conta" : "Enviar link de acesso"}
          </button>
        </form>
        {msg && <p role="status" style={{ font: "13px/1.4 var(--font-body)", color: msg.ok ? "var(--green-ink)" : "#b01d31" }}>{msg.text}</p>}
        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
          <button className="link-btn" onClick={() => setMode(mode === "criar" ? "entrar" : "criar")}>
            {mode === "criar" ? "Já tenho conta" : "Criar conta"}
          </button>
          <button className="link-btn" onClick={() => setMode(mode === "link" ? "entrar" : "link")}>
            {mode === "link" ? "Usar senha" : "Entrar por link no e-mail"}
          </button>
        </div>
      </div>
    </div>
  );
}
