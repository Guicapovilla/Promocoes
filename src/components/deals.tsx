"use client";

import { useState } from "react";
import { fmt } from "@/lib/format";
import { SORTS, sortBy, TONES, type SortKey, type Tone } from "@/lib/pricing";
import { PickLink } from "./pick-link";

export type Deal = {
  id: string;
  slug: string;
  name: string;
  store: string;
  price: number;
  tone: Tone;
  pct: number;
  pos: number;
  yearLow: boolean;
  rec: boolean;
  imageUrl: string | null;
  likes: number;
  rating: number;
  popularity: number;
};

export function SortMenu({ value, onChange }: { value: SortKey; onChange: (k: SortKey) => void }) {
  const [open, setOpen] = useState(false);
  const cur = SORTS.find((s) => s[0] === value)!;
  return (
    <div style={{ position: "relative" }}>
      <button className="sort-btn" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {cur[1]}
          <span style={{ color: "var(--primary-600)", fontSize: 13 }}>{cur[2]}</span>
        </span>
        <span className="caret">▼</span>
      </button>
      {open && (
        <>
          <div className="scrim" onClick={() => setOpen(false)} />
          <div className="dropdown sort-menu" role="listbox">
            {SORTS.map(([k, label, icon]) => (
              <button key={k} role="option" aria-selected={value === k} aria-checked={value === k} className="sort-opt" onClick={() => { onChange(k); setOpen(false); }}>
                <span>{label}</span>
                <span style={{ opacity: 0.75 }}>{icon}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function Deals({ deals }: { deals: Deal[] }) {
  const [sort, setSort] = useState<SortKey>("popular");
  const list = sortBy(deals, sort);
  return (
    <div className="section">
      <div className="section-head">
        <div>
          <h2 className="h2">Outras promoções</h2>
          <p className="sub-sm">Só aparecem aqui produtos abaixo ou na média dos últimos 6 meses.</p>
        </div>
        <SortMenu value={sort} onChange={setSort} />
      </div>
      <div className="grid-fill" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(min(260px, 100%), 1fr))" }}>
        {list.map((d) => {
          const T = TONES[d.tone];
          return (
            <PickLink key={d.id} slug={d.slug} productId={d.id} price={d.price} className="card deal hover-lift">
              <div className="stripes photo">
                {d.imageUrl ? <img src={d.imageUrl} alt="" /> : "foto do produto"}
                <div className="tags">
                  {d.yearLow && <span className="tag" style={{ background: "var(--green)" }}>Menor preço do ano</span>}
                  {d.rec && <span className="tag" style={{ background: "#15131b" }}>Capovilla recomenda</span>}
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ font: "600 15px/1.3 var(--font-body)", color: "var(--text-primary)" }}>{d.name}</span>
                <span className="muted" style={{ font: "var(--text-body-sm)" }}>{d.store} · ★ {d.rating.toFixed(1)} · ♡ {d.likes}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <span style={{ font: "400 30px/1 var(--font-display)", color: "var(--text-primary)" }}>{fmt(d.price)}</span>
                <span className="pill" style={{ font: "600 12px/1 var(--font-body)", color: T.ink, background: T.tint, padding: "6px 9px" }}>
                  {(d.pct > 0 ? "+" : "") + d.pct}% vs média
                </span>
              </div>
              <div className="mini-bar"><i style={{ left: `${d.pos}%` }} /></div>
            </PickLink>
          );
        })}
      </div>
    </div>
  );
}
