"use client";

import { useState, useTransition } from "react";
import { setRadarNotify, setRadarTarget } from "@/app/actions";
import { fmt, numBR } from "@/lib/format";
import { TONES } from "@/lib/pricing";
import { PickLink } from "./pick-link";
import { useUi } from "./ui-provider";

export type RadarRow = {
  id: string;
  slug: string;
  name: string;
  store: string;
  price: number;
  autoTarget: number;
  customTarget: number | null;
  notify: boolean;
  hit: boolean;
  gap: number;
  progress: number;
};

function Row({ r }: { r: RadarRow }) {
  const { toggleRadar } = useUi();
  const [, start] = useTransition();
  const custom = r.customTarget != null;
  const [val, setVal] = useState(numBR(custom ? r.customTarget! : r.autoTarget));
  const [lastProp, setLastProp] = useState(r.customTarget ?? r.autoTarget);
  const prop = r.customTarget ?? r.autoTarget;
  if (prop !== lastProp) { setLastProp(prop); setVal(numBR(prop)); } // sincroniza após o refresh do servidor

  const commit = () => {
    if (val === numBR(prop)) return;
    start(() => void setRadarTarget(r.id, val));
  };

  return (
    <div className="radar-row">
      <PickLink slug={r.slug} productId={r.id} price={r.price} style={{ display: "flex", gap: 14, alignItems: "center", minWidth: 0, color: "inherit" }}>
        <div className="stripes" style={{ width: 48, height: 48, flexShrink: 0, borderRadius: "var(--radius-sm)" }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
          <span style={{ font: "600 15px/1.3 var(--font-body)", color: "var(--text-primary)" }}>{r.name}</span>
          <span className="muted" style={{ font: "var(--text-body-sm)" }}>{r.store}</span>
        </div>
      </PickLink>
      <span style={{ font: "600 15px/1 var(--font-body)", whiteSpace: "nowrap" }}>{fmt(r.price)}</span>
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        <div className={"target-input" + (custom ? " custom" : "")}>
          <span className="muted" style={{ font: "13px/1 var(--font-body)" }}>R$</span>
          <input
            value={val}
            inputMode="decimal"
            aria-label={`Preço-alvo de ${r.name}`}
            onChange={(e) => setVal(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
          />
        </div>
        <button
          style={{ alignSelf: "flex-start", background: "transparent", border: 0, padding: 0, font: "12px/1.3 var(--font-body)", color: custom ? "var(--primary-600)" : "var(--text-muted)", cursor: custom ? "pointer" : "default", textAlign: "left" }}
          onClick={() => custom && start(() => void setRadarTarget(r.id, null))}
        >
          {custom ? "Seu alvo · usar automático" : "Automático: 5% abaixo da média"}
        </button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-start" }}>
        <span className="pill" style={{ font: "600 12px/1 var(--font-body)", padding: "6px 10px", color: r.hit ? TONES.success.ink : "var(--text-secondary)", background: r.hit ? TONES.success.tint : "var(--chip)" }}>
          {r.hit ? "No alvo" : `Faltam ${r.gap}%`}
        </span>
        <div style={{ width: "100%", maxWidth: 120, height: 4, borderRadius: 2, background: "#ebe9ef", overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${r.progress}%`, background: r.hit ? "var(--green)" : "#9b2bff", borderRadius: 2, transition: "width 400ms ease-out" }} />
        </div>
      </div>
      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
        <button className="small-btn" aria-pressed={r.notify} onClick={() => start(() => void setRadarNotify(r.id, !r.notify))}>
          {r.notify ? "Avisando" : "Avisar"}
        </button>
        <button className="small-btn danger" onClick={() => toggleRadar(r.id, r.name)}>Remover</button>
      </div>
    </div>
  );
}

export function RadarTable({ rows, addable }: { rows: RadarRow[]; addable: { id: string; name: string }[] }) {
  const { toggleRadar } = useUi();
  const hits = rows.filter((r) => r.hit).length;
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="h1">Meu radar</h1>
          <p className="sub">Produtos acompanhados. A notificação chega quando o preço atinge o alvo, que pode ser editado.</p>
        </div>
        <span className="muted" style={{ font: "var(--text-body-sm)" }}>
          {rows.length} {rows.length === 1 ? "produto" : "produtos"} · {hits} no alvo hoje
        </span>
      </div>
      <div className="card radar-table">
        <div className="radar-row head"><span>Produto</span><span>Agora</span><span>Alvo</span><span>Status</span><span /></div>
        {rows.map((r) => <Row key={r.id} r={r} />)}
        {rows.length === 0 && (
          <div style={{ padding: "40px 24px", textAlign: "center", display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ font: "600 15px/1.3 var(--font-body)" }}>Nenhum produto no radar ainda</span>
            <span className="muted" style={{ font: "14px/1.4 var(--font-body)" }}>Escolha um produto abaixo para ser avisado quando ele chegar num bom preço.</span>
          </div>
        )}
      </div>
      {addable.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <span style={{ font: "600 15px/1.3 var(--font-body)" }}>Adicionar ao radar</span>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {addable.map((a) => <button key={a.id} className="chip-add" onClick={() => toggleRadar(a.id, a.name)}>+ {a.name}</button>)}
          </div>
        </div>
      )}
    </div>
  );
}
