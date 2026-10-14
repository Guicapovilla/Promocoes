"use client";

import { useEffect, useState } from "react";
import { ddmm, fmt, fmtK } from "@/lib/format";
import { DEFAULT_RANGE, forecastText, isYearLow, lowSince, markerPos, pctLabel, RANGES, stats, TONES, type PricePoint, type RangeKey } from "@/lib/pricing";
import { readRecent, type Recent } from "@/lib/recent";
import { PickLink } from "./pick-link";
import { useUi } from "./ui-provider";

export type FeaturedProduct = {
  id: string;
  name: string;
  category: string;
  imageUrl: string | null;
  recNote: string | null;
  recVideoTitle: string | null;
  recVideoUrl: string | null;
  bfDropPct: number;
  series: PricePoint[];
  price: number;
  store: string;
  offerId: string;
  offers: { id: string; store: string; price: number }[];
};
export type CatalogItem = { id: string; slug: string; name: string; price: number };

const W = 600;
const H = 220;

export function Featured({ p, catalog, event }: { p: FeaturedProduct; catalog: CatalogItem[]; event?: { name: string; days: number } }) {
  const { inRadar, toggleRadar } = useUi();
  const [range, setRange] = useState<RangeKey>(DEFAULT_RANGE);
  const rg = RANGES.find((r) => r.key === range)!;
  const s = stats(p.series, rg.days);
  const T = TONES[s.tone];
  const yearLow = isYearLow(p.series);
  const pos = markerPos(p.price, s.min, s.max);
  const shift = pos < 25 ? "-12%" : pos > 75 ? "-88%" : "-50%";

  // gráfico
  const lo = s.min * 0.96;
  const hi = s.max * 1.03;
  const y = (v: number) => ((1 - (v - lo) / (hi - lo)) * H).toFixed(1);
  const step = Math.max(1, Math.floor(s.h.length / 120));
  const sampled = s.h.filter((_, i) => i % step === 0 || i === s.h.length - 1);
  const points = sampled.map((pt, i) => `${((i / Math.max(1, sampled.length - 1)) * W).toFixed(1)},${y(pt.price)}`).join(" ");
  const yLabels = [0, 1, 2, 3].map((k) => fmtK(hi - ((hi - lo) * k) / 3));
  const xLabels = [0, 1, 2, 3, 4, 5].map((k) => ddmm(s.h[Math.round(((s.h.length - 1) * k) / 5)].date));

  const onRadar = inRadar(p.id);

  return (
    <>
      <div className="card featured">
        <div className="stripes photo">{p.imageUrl ? <img src={p.imageUrl} alt="" /> : "foto do produto"}</div>
        <div className="info">
          <span className="muted" style={{ font: "var(--text-body-sm)" }}>{p.category}</span>
          <h2>{p.name}</h2>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <span className="verdict" style={{ color: T.ink, background: T.tint }}>
              <span className="dot" style={{ background: T.dot }} />
              {T.verdict}
            </span>
            {yearLow && <span className="verdict" style={{ color: "#fff", background: "var(--green)" }}>Menor preço do ano</span>}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end" }}>
          <span className="muted" style={{ font: "var(--text-body-sm)" }}>Menor preço agora · {p.store}</span>
          <span className="price-big">{fmt(p.price)}</span>
          <span className="secondary" style={{ font: "var(--text-body-sm)" }}>ou 12x de {fmt(p.price / 12)}</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <a className="btn btn-lg btn-primary glow" style={{ color: "#fff" }} href={`/go/${p.offerId}`} target="_blank" rel="noreferrer">
            Ver na {p.store}
          </a>
          <button className="btn btn-md btn-outline" onClick={() => toggleRadar(p.id, p.name)}>
            {onRadar ? "No radar ✓" : "Adicionar ao radar"}
          </button>
        </div>
        <div className="featured-extra">
          {p.recNote && (
            <a className="note-box link" href={p.recVideoUrl ?? "#"} target="_blank" rel="noreferrer">
              <img src="/assets/guilherme-profile.png" alt="" />
              <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
                <span className="kicker" style={{ color: "var(--primary-700)" }}>Capovilla recomenda</span>
                <span style={{ font: "14px/1.4 var(--font-body)" }}>“{p.recNote}”</span>
                {p.recVideoTitle && <span style={{ font: "12px/1.3 var(--font-body)", color: "var(--primary-600)" }}>Ver análise: {p.recVideoTitle} →</span>}
              </div>
            </a>
          )}
          <div className="note-box" style={{ flexDirection: "column", alignItems: "flex-start", gap: 4, justifyContent: "center" }}>
            <span className="kicker muted">Comprar agora ou esperar?</span>
            <span style={{ font: "14px/1.45 var(--font-body)", textWrap: "pretty" }}>
              {forecastText({ tone: s.tone, pct: s.pct, bfDropPct: p.bfDropPct, event })}
            </span>
          </div>
        </div>
      </div>

      <div className="grid-2x2">
        <div className="card" style={{ display: "flex", flexDirection: "column" }}>
          <div className="card-head">Referência de preço</div>
          <div className="ref-body">
            <div style={{ position: "relative", paddingTop: 64 }}>
              <div className="ref-bubble" style={{ left: `${pos}%`, transform: `translateX(${shift})`, background: T.bubble }}>
                O preço de <strong>{fmt(p.price)}</strong> {T.text}
              </div>
              <div className="ref-arrow" style={{ left: `${pos}%`, background: T.bubble }} />
              <div className="ref-bar">
                <div className="ref-marker" style={{ left: `${pos}%`, borderColor: T.bubble }} />
              </div>
              <div className="muted" style={{ display: "flex", justifyContent: "space-between", marginTop: 10, font: "var(--text-body-sm)" }}>
                <span>Mínimo {fmt(s.min)}</span>
                <span>Máximo {fmt(s.max)}</span>
              </div>
            </div>
            <div className="metrics">
              <div><span className="muted" style={{ font: "var(--text-body-sm)" }}>Média {rg.label}</span><b>{fmt(s.avg)}</b></div>
              <div><span className="muted" style={{ font: "var(--text-body-sm)" }}>Vs. média</span><b style={{ color: T.ink }}>{pctLabel(s.pct)}</b></div>
              <div><span className="muted" style={{ font: "var(--text-body-sm)" }}>Menor desde</span><b>{lowSince(p.series)}</b></div>
            </div>
          </div>
        </div>

        <div className="card" style={{ display: "flex", flexDirection: "column" }}>
          <div className="card-head" style={{ padding: "14px 16px 14px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <span>Histórico de preço</span>
            <div className="seg">
              {RANGES.map((r) => (
                <button key={r.key} aria-pressed={range === r.key} onClick={() => setRange(r.key)}>{r.label}</button>
              ))}
            </div>
          </div>
          <div className="chart-wrap">
            <div className="chart-y">{yLabels.map((l, i) => <span key={i}>{l}</span>)}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {/* key força a animação de desenho a cada troca de produto/período */}
              <svg key={`${p.id}-${range}`} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: "100%", height: H, display: "block" }} role="img" aria-label={`Histórico de preço de ${p.name}`}>
                <defs>
                  <linearGradient id="cpFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#9b2bff" stopOpacity="0.22" />
                    <stop offset="100%" stopColor="#9b2bff" stopOpacity="0" />
                  </linearGradient>
                </defs>
                {[0.5, 73, 146, 219.5].map((yy) => <line key={yy} x1="0" x2={W} y1={yy} y2={yy} stroke="#ebe9ef" />)}
                <line x1="0" x2={W} y1={y(s.avg)} y2={y(s.avg)} stroke="#837c93" strokeDasharray="4 5" vectorEffect="non-scaling-stroke" />
                <polygon points={`0,${H} ${points} ${W},${H}`} fill="url(#cpFill)" style={{ animation: "cpFade 700ms 500ms ease-out both" }} />
                <polyline points={points} fill="none" stroke="#8712f0" strokeWidth="2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" style={{ strokeDasharray: 2400, animation: "cpDraw 1.1s 200ms ease-out both" }} />
              </svg>
              <div className="chart-x">{xLabels.map((l, i) => <span key={i}>{l}</span>)}</div>
              <span className="muted" style={{ font: "12px/1.4 var(--font-body)" }}>Linha tracejada = média do período</span>
            </div>
          </div>
        </div>

        <div className="card" style={{ display: "flex", flexDirection: "column" }}>
          <div className="card-head">Preço por loja</div>
          <div style={{ padding: "8px 12px 12px", display: "flex", flexDirection: "column" }}>
            {p.offers.slice(0, 5).map((o, i) => (
              <a key={o.id} className="list-row" href={`/go/${o.id}`} target="_blank" rel="noreferrer">
                <span style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <span>{o.store}</span>
                  {i === 0 && <span className="pill" style={{ font: "600 11px/1 var(--font-body)", color: "var(--green-ink)", background: "rgba(61,220,132,0.16)", padding: "4px 8px" }}>menor preço</span>}
                </span>
                <span style={{ font: "600 15px/1 var(--font-body)" }}>{fmt(o.price)}</span>
              </a>
            ))}
          </div>
        </div>

        <RecentViewed catalog={catalog} />
      </div>
    </>
  );
}

function RecentViewed({ catalog }: { catalog: CatalogItem[] }) {
  const [recent, setRecent] = useState<Recent[]>([]);
  useEffect(() => setRecent(readRecent()), []);
  const rows = recent
    .map((r) => ({ r, x: catalog.find((c) => c.id === r.id) }))
    .filter((v): v is { r: Recent; x: CatalogItem } => !!v.x);

  return (
    <div className="card" style={{ display: "flex", flexDirection: "column" }}>
      <div className="card-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
        <span>Visto por último</span>
        <span className="muted" style={{ font: "var(--text-body-sm)", fontWeight: 400 }}>desde sua última visita</span>
      </div>
      <div style={{ padding: "8px 12px 12px", display: "flex", flexDirection: "column" }}>
        {rows.length === 0 && <p className="muted" style={{ padding: 12, font: "14px/1.4 var(--font-body)" }}>Os produtos que você abrir aparecem aqui, com a variação de preço desde a visita.</p>}
        {rows.map(({ r, x }) => {
          const d = x.price - r.then;
          const same = Math.abs(d) < 0.01;
          const tone = same ? null : d < 0 ? TONES.success : TONES.danger;
          return (
            <PickLink key={x.id} slug={x.slug} productId={x.id} price={x.price} className="list-row" style={{ padding: 12 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
                <span style={{ font: "600 15px/1.3 var(--font-body)" }}>{x.name}</span>
                <span className="muted" style={{ font: "var(--text-body-sm)" }}>era {fmt(r.then)} · agora {fmt(x.price)}</span>
              </div>
              <span className="pill" style={{ font: "600 13px/1 var(--font-body)", padding: "6px 10px", color: tone?.ink ?? "var(--text-secondary)", background: tone?.tint ?? "var(--chip)" }}>
                {same ? "sem mudança" : (d < 0 ? "caiu " : "subiu ") + fmt(Math.abs(d))}
              </span>
            </PickLink>
          );
        })}
      </div>
    </div>
  );
}
