"use client";

import { useState } from "react";
import { withUtm } from "@/lib/affiliate";
import { fmt } from "@/lib/format";
import type { Service } from "@/lib/types";

const CATS = ["Todos", "Desbloqueio", "Conserto", "Manutenção", "Upgrade"];

export function ServicesView({ services }: { services: Service[] }) {
  const [cat, setCat] = useState("Todos");
  const list = services.filter((s) => cat === "Todos" || s.category === cat);
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="h1">Serviços parceiros</h1>
          <p className="sub">Lojas indicadas pelo canal. O contato e o atendimento são feitos direto com a loja.</p>
        </div>
        <div className="seg">
          {CATS.map((c) => <button key={c} aria-pressed={cat === c} onClick={() => setCat(c)}>{c}</button>)}
        </div>
      </div>
      <div className="grid-fill" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(min(340px, 100%), 1fr))" }}>
        {list.map((s) => (
          <div key={s.id} className="card svc">
            <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
              <div className="stripes" style={{ width: 52, height: 52, flexShrink: 0, borderRadius: "var(--radius-md)", fontSize: 9 }}>
                {s.logo_url ? <img src={s.logo_url} alt="" /> : "logo"}
              </div>
              <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
                <span style={{ font: "600 16px/1.3 var(--font-body)" }}>{s.store}</span>
                <span className="muted" style={{ font: "13px/1.3 var(--font-body)" }}>{s.city}</span>
              </div>
              <span className="pill secondary" style={{ font: "600 12px/1 var(--font-body)", background: "var(--chip)", padding: "6px 10px" }}>{s.category}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ font: "600 15px/1.35 var(--font-body)" }}>{s.title}</span>
              <span className="secondary" style={{ font: "13px/1.5 var(--font-body)", textWrap: "pretty" }}>{s.description}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "12px 14px", background: "var(--bg-page)", borderRadius: "var(--radius-sm)" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <span className="muted" style={{ font: "12px/1 var(--font-body)" }}>A partir de</span>
                <span style={{ font: "400 24px/1 var(--font-display)" }}>{fmt(s.price_from)}</span>
              </div>
              {s.perk && <span className="pill" style={{ font: "600 12px/1.3 var(--font-body)", color: "var(--primary-700)", background: "var(--primary-100)", padding: "6px 10px", textAlign: "right" }}>{s.perk}</span>}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <a className="btn btn-md btn-primary" style={{ flex: 1, color: "#fff" }} href={withUtm(s.contact_url, s.id)} target="_blank" rel="noreferrer">Falar com a loja</a>
              <a className="btn btn-md btn-outline" href={withUtm(s.details_url ?? s.contact_url, s.id)} target="_blank" rel="noreferrer">Ver detalhes</a>
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 16, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", padding: "18px 20px", border: "1px dashed var(--border-default)", borderRadius: "var(--radius-lg)" }}>
        <span className="secondary" style={{ font: "14px/1.5 var(--font-body)" }}>Tem uma loja ou presta serviço para consoles? O canal está aceitando novos parceiros.</span>
        <a href={process.env.NEXT_PUBLIC_PARTNER_URL || "#"} style={{ font: "600 14px/1 var(--font-body)" }}>Quero ser parceiro →</a>
      </div>
    </div>
  );
}
