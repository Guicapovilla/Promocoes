"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { markNotificationRead, savePushSubscription, saveSettings, sendSuggestion, setRadar } from "@/app/actions";
import { fmt, timeAgo } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import type { AppNotification, Channels, Profile, Purchase, RadarItem, TriggerKind } from "@/lib/types";
import { CloseIcon } from "./icons";

type Toast = {
  id: string;
  dot: string;
  title: string;
  body: string;
  when?: string;
  go?: string; // slug do produto
  action?: { label: string; fn: () => void };
};

type Ui = {
  radar: RadarItem[];
  inRadar: (productId: string) => boolean;
  toggleRadar: (productId: string, name: string) => void;
  notify: (t: Omit<Toast, "id" | "dot"> & { dot?: string }) => void;
  openSettings: () => void;
  openEconomy: () => void;
  openHelp: (tab?: "faq" | "suggest", preset?: { type: string; text: string }) => void;
  economyTotal: number;
};

const Ctx = createContext<Ui | null>(null);
export const useUi = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error("useUi fora do UiProvider");
  return v;
};

const CH_DEFS: [keyof Channels, string, string][] = [
  ["site", "Avisos no site", "Aparecem no canto da tela enquanto o site está aberto"],
  ["push", "Notificação do navegador", "Chega mesmo com o site fechado"],
  ["email", "E-mail", ""],
  ["wpp", "WhatsApp", ""],
];
const TR_DEFS: [TriggerKind, string, string][] = [
  ["alvo", "Quando atingir o preço-alvo", "5% abaixo da média de 6 meses"],
  ["minimo", "Só no menor preço do ano", "Menos avisos, só as melhores oportunidades"],
  ["qualquer", "Qualquer queda de preço", "Todo movimento para baixo"],
];
const FAQ: [string, string][] = [
  ["Como o preço é classificado?", "Verde quando está 5% ou mais abaixo da média do período, amarelo até 3% acima e vermelho acima disso."],
  ["De onde vêm os preços?", "As lojas são consultadas automaticamente várias vezes ao dia. O horário da última leitura aparece no topo da página."],
  ["Como funciona o radar?", "Adicione um produto ao radar e escolha nas configurações como e quando quer ser avisado."],
  ["Os links são de afiliado?", "Sim. O preço é o mesmo para quem compra, e uma comissão ajuda a manter o canal."],
];

function urlBase64ToUint8Array(b64: string) {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

async function subscribePush(): Promise<boolean> {
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!key || !("serviceWorker" in navigator) || !("PushManager" in window)) return false;
  if ((await Notification.requestPermission()) !== "granted") return false;
  const reg = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key) }));
  await savePushSubscription(sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } });
  return true;
}

export function UiProvider({
  profile,
  radar,
  purchases,
  initialNotifications,
  productSlugs,
  children,
}: {
  profile: Profile;
  radar: RadarItem[];
  purchases: Purchase[];
  initialNotifications: AppNotification[];
  productSlugs: Record<string, string>;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [economyOpen, setEconomyOpen] = useState(false);
  const [help, setHelp] = useState<{ open: boolean; tab: "faq" | "suggest"; type: string; text: string }>({ open: false, tab: "faq", type: "Melhoria", text: "" });
  const timers = useRef<number[]>([]);
  const seen = useRef(new Set<string>());

  const dismiss = useCallback((id: string) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const notify = useCallback<Ui["notify"]>((t) => {
    const id = crypto.randomUUID();
    setToasts((list) => [...list, { dot: "#9b2bff", ...t, id }]);
    timers.current.push(window.setTimeout(() => dismiss(id), 5000));
  }, [dismiss]);

  const inRadar = useCallback((pid: string) => radar.some((r) => r.product_id === pid), [radar]);

  const toggleRadar = useCallback<Ui["toggleRadar"]>(
    (pid, name) => {
      const had = inRadar(pid);
      startTransition(async () => {
        await setRadar(pid, !had);
        notify({
          title: had ? "Removido do radar" : "Adicionado ao radar",
          body: name,
          action: { label: "Desfazer", fn: () => startTransition(() => void setRadar(pid, had)) },
        });
      });
    },
    [inRadar, notify],
  );

  // avisos do servidor (radar) → toasts; Realtime + leitura inicial
  useEffect(() => {
    const show = (n: AppNotification) => {
      if (seen.current.has(n.id)) return;
      seen.current.add(n.id);
      const slug = n.product_id ? productSlugs[n.product_id] : undefined;
      notify({ dot: "#1f9b57", title: n.title, body: n.body, when: timeAgo(n.created_at), go: slug });
      void markNotificationRead(n.id);
    };
    initialNotifications.forEach(show);
    if (!profile.channels.site) return;
    const supabase = createClient();
    const ch = supabase
      .channel("avisos")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${profile.user_id}` }, (p) => show(p.new as AppNotification))
      .subscribe();
    return () => void supabase.removeChannel(ch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.user_id, profile.channels.site]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSettingsOpen(false);
        setEconomyOpen(false);
        setHelp((h) => ({ ...h, open: false }));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      timers.current.forEach(clearTimeout);
    };
  }, []);

  const economyTotal = useMemo(() => purchases.reduce((a, p) => a + (p.avg_at_purchase - p.paid), 0), [purchases]);

  const value: Ui = {
    radar,
    inRadar,
    toggleRadar,
    notify,
    economyTotal,
    openSettings: () => setSettingsOpen(true),
    openEconomy: () => setEconomyOpen(true),
    openHelp: (tab = "faq", preset) => setHelp((h) => ({ ...h, open: true, tab, ...(preset ? { type: preset.type, text: preset.text } : {}) })),
  };

  return (
    <Ctx.Provider value={value}>
      {children}

      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((n) => (
          <div className="toast" key={n.id}>
            <span className="dot" style={{ width: 8, height: 8, marginTop: 6, background: n.dot }} />
            <div
              style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3, cursor: n.go ? "pointer" : "default" }}
              onClick={() => {
                if (!n.go) return;
                dismiss(n.id);
                router.push(`/?p=${n.go}`);
              }}
            >
              <span style={{ font: "600 14px/1.35 var(--font-body)" }}>{n.title}</span>
              <span className="secondary" style={{ font: "13px/1.4 var(--font-body)" }}>{n.body}</span>
              {n.when && <span className="muted" style={{ font: "12px/1.3 var(--font-body)" }}>{n.when}</span>}
            </div>
            {n.action && (
              <button
                className="link-btn"
                style={{ alignSelf: "center", minHeight: 36, padding: "0 8px", fontSize: 13 }}
                onClick={() => {
                  n.action!.fn();
                  dismiss(n.id);
                }}
              >
                {n.action.label}
              </button>
            )}
            <button className="icon-btn" aria-label="Fechar aviso" onClick={() => dismiss(n.id)}>
              <CloseIcon />
            </button>
          </div>
        ))}
      </div>

      {economyOpen && (
        <div className="modal-bg" onClick={() => setEconomyOpen(false)}>
          <div className="modal" style={{ maxWidth: 560 }} role="dialog" aria-modal="true" aria-label="Minha economia" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <span>Minha economia</span>
              <button className="icon-btn lg" aria-label="Fechar" onClick={() => setEconomyOpen(false)}><CloseIcon /></button>
            </div>
            <div style={{ padding: "28px 24px 20px", display: "flex", flexDirection: "column", gap: 6 }}>
              {profile.supporter_since && (
                <span className="muted" style={{ font: "13px/1 var(--font-body)" }}>
                  Economizado desde {profile.supporter_since.slice(5, 7)}/{profile.supporter_since.slice(0, 4)}
                </span>
              )}
              <span style={{ font: "400 64px/1 var(--font-display)", color: "var(--green-ink)" }}>{fmt(economyTotal)}</span>
              <span className="secondary" style={{ font: "14px/1.45 var(--font-body)" }}>
                {purchases.length === 0
                  ? "Nenhuma compra confirmada ainda. Compre pelos links da central e a economia aparece aqui."
                  : `Em ${purchases.length} ${purchases.length === 1 ? "compra" : "compras"} pelos links da central, comparado à média de 6 meses de cada produto no dia da compra.`}
              </span>
            </div>
            <div style={{ padding: "0 24px 8px", display: "flex", flexDirection: "column" }}>
              {purchases.map((p) => (
                <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, padding: "14px 0", borderTop: "1px solid var(--border-subtle)" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
                    <span style={{ font: "600 14px/1.3 var(--font-body)" }}>{p.name}</span>
                    <span className="muted" style={{ font: "12px/1.3 var(--font-body)" }}>
                      {p.date.slice(8, 10)}/{p.date.slice(5, 7)}/{p.date.slice(0, 4)} · pagou {fmt(p.paid)} · média {fmt(p.avg_at_purchase)}
                    </span>
                  </div>
                  <span className="pill" style={{ font: "600 13px/1 var(--font-body)", color: "var(--green-ink)", background: "rgba(61,220,132,0.16)", padding: "6px 10px" }}>
                    -{fmt(p.avg_at_purchase - p.paid)}
                  </span>
                </div>
              ))}
            </div>
            <div className="muted" style={{ padding: "16px 24px 20px", borderTop: "1px solid var(--border-subtle)", font: "12px/1.45 var(--font-body)" }}>
              Compras feitas pelos links da central são registradas automaticamente quando a loja confirma o pedido.
            </div>
          </div>
        </div>
      )}

      {settingsOpen && (
        <SettingsModal
          profile={profile}
          onClose={() => setSettingsOpen(false)}
          onSaved={() => {
            setSettingsOpen(false);
            notify({ title: "Configurações salvas", body: "Os avisos já seguem as novas preferências." });
          }}
        />
      )}

      <div className="help-wrap">
        {help.open && (
          <HelpPanel state={help} setState={setHelp} />
        )}
        <button className="help-fab" onClick={() => setHelp((h) => ({ ...h, open: !h.open }))}>
          {help.open ? "Fechar" : "Ajuda e sugestões"}
        </button>
      </div>
    </Ctx.Provider>
  );
}

function SettingsModal({ profile, onClose, onSaved }: { profile: Profile; onClose: () => void; onSaved: () => void }) {
  const [ch, setCh] = useState<Channels>(profile.channels);
  const [trigger, setTrigger] = useState<TriggerKind>(profile.trigger);
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState("");

  const desc = (k: keyof Channels, d: string) =>
    k === "email" ? profile.email ?? "" : k === "wpp" ? (profile.whatsapp ? profile.whatsapp.replace(/\d(?=\d{4})/g, "•") : "Cadastre o número com o suporte") : d;

  const toggle = async (k: keyof Channels) => {
    const next = !ch[k];
    if (k === "push" && next) {
      const ok = await subscribePush().catch(() => false);
      if (!ok) {
        setErr("Não foi possível ativar as notificações do navegador (permissão negada ou navegador sem suporte).");
        return;
      }
    }
    setErr("");
    setCh({ ...ch, [k]: next });
  };

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 520 }} role="dialog" aria-modal="true" aria-label="Configurações" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span>Configurações</span>
          <button className="icon-btn lg" aria-label="Fechar" onClick={onClose}><CloseIcon /></button>
        </div>
        <div className="over-label">Como receber os avisos</div>
        <div style={{ padding: "0 24px", display: "flex", flexDirection: "column" }}>
          {CH_DEFS.map(([k, label, d]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, padding: "14px 0", borderBottom: "1px solid var(--border-subtle)" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <span style={{ font: "600 14px/1.3 var(--font-body)" }}>{label}</span>
                <span className="muted" style={{ font: "13px/1.4 var(--font-body)" }}>{desc(k, d)}</span>
              </div>
              <button className="switch" role="switch" aria-checked={ch[k]} aria-label={label} onClick={() => void toggle(k)}>
                <span />
              </button>
            </div>
          ))}
        </div>
        {err && <p style={{ padding: "10px 24px 0", color: "#b01d31", font: "13px/1.4 var(--font-body)" }}>{err}</p>}
        <div className="over-label">Quando avisar</div>
        <div role="radiogroup" style={{ padding: "8px 24px 0", display: "flex", flexDirection: "column", gap: 8 }}>
          {TR_DEFS.map(([k, label, d]) => (
            <button key={k} role="radio" aria-checked={trigger === k} className="radio-card" onClick={() => setTrigger(k)}>
              <span className="ring" />
              <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ font: "600 14px/1.3 var(--font-body)" }}>{label}</span>
                <span className="muted" style={{ font: "13px/1.4 var(--font-body)" }}>{d}</span>
              </span>
            </button>
          ))}
        </div>
        <div style={{ padding: "20px 24px", display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12, borderTop: "1px solid var(--border-subtle)" }}>
          <button className="btn btn-md btn-outline" onClick={onClose}>Cancelar</button>
          <button
            className="btn btn-md btn-primary"
            disabled={pending}
            onClick={() => startTransition(async () => { await saveSettings(ch, trigger); onSaved(); })}
          >
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}

function HelpPanel({
  state,
  setState,
}: {
  state: { open: boolean; tab: "faq" | "suggest"; type: string; text: string };
  setState: React.Dispatch<React.SetStateAction<{ open: boolean; tab: "faq" | "suggest"; type: string; text: string }>>;
}) {
  const [faqOpen, setFaqOpen] = useState(-1);
  const [sent, setSent] = useState(false);
  const [pending, startTransition] = useTransition();
  return (
    <div className="help-panel">
      <div className="help-tabs">
        {(["faq", "suggest"] as const).map((k) => (
          <button key={k} aria-pressed={state.tab === k} onClick={() => { setState((s) => ({ ...s, tab: k })); setSent(false); }}>
            {k === "faq" ? "Ajuda" : "Enviar sugestão"}
          </button>
        ))}
      </div>
      {state.tab === "faq" ? (
        <div style={{ padding: "6px 8px 10px", display: "flex", flexDirection: "column" }}>
          {FAQ.map(([q, a], i) => (
            <div key={q}>
              <button
                className="menu-item"
                style={{ width: "100%", gap: 10, padding: "12px 10px", font: "600 14px/1.35 var(--font-body)" }}
                aria-expanded={faqOpen === i}
                onClick={() => setFaqOpen(faqOpen === i ? -1 : i)}
              >
                <span>{q}</span>
                <span className="muted">{faqOpen === i ? "−" : "+"}</span>
              </button>
              {faqOpen === i && <p className="secondary" style={{ padding: "0 10px 12px", font: "13px/1.5 var(--font-body)", animation: "cpFadeUp 200ms ease-out both" }}>{a}</p>}
            </div>
          ))}
        </div>
      ) : (
        <div style={{ padding: "16px 18px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
          {sent ? (
            <div style={{ padding: "20px 4px", textAlign: "center", display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ font: "600 15px/1.3 var(--font-body)" }}>Sugestão enviada</span>
              <span className="muted" style={{ font: "13px/1.4 var(--font-body)" }}>Toda sugestão é lida. Obrigado por ajudar a melhorar a central.</span>
            </div>
          ) : (
            <>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {["Melhoria", "Problema", "Novo produto"].map((l) => (
                  <button key={l} className="chip-choice" aria-pressed={state.type === l} onClick={() => setState((s) => ({ ...s, type: l }))}>{l}</button>
                ))}
              </div>
              <textarea
                className="textarea"
                rows={4}
                placeholder="Ex.: acompanhar preço de cartões de memória"
                value={state.text}
                onChange={(e) => setState((s) => ({ ...s, text: e.target.value }))}
              />
              <button
                className="btn btn-md btn-primary"
                disabled={pending || state.text.trim().length < 3}
                onClick={() =>
                  startTransition(async () => {
                    await sendSuggestion(state.type, state.text);
                    setSent(true);
                    setState((s) => ({ ...s, text: "" }));
                  })
                }
              >
                Enviar sugestão
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
