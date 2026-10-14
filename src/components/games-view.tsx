"use client";

import { useState } from "react";
import { fmt } from "@/lib/format";
import { sortBy, type SortKey } from "@/lib/pricing";
import type { Game } from "@/lib/types";
import { SortMenu } from "./deals";

const PLATFORMS = ["Todas", "Steam", "PSN", "Xbox", "Nintendo"];

export function GamesView({ games }: { games: Game[] }) {
  const [platform, setPlatform] = useState("Todas");
  const [sort, setSort] = useState<SortKey>("popular");
  const list = sortBy(games.filter((g) => platform === "Todas" || g.platform === platform), sort);
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="h1">Jogos em desconto</h1>
          <p className="sub">Chaves digitais via Eneba. A compra pelo link apoia o canal.</p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <div className="seg">
            {PLATFORMS.map((p) => <button key={p} aria-pressed={platform === p} onClick={() => setPlatform(p)}>{p}</button>)}
          </div>
          <SortMenu value={sort} onChange={setSort} />
        </div>
      </div>
      {list.length === 0 && <p className="muted">Nenhum jogo em desconto para esta plataforma agora.</p>}
      <div className="grid-fill" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(min(210px, 100%), 1fr))" }}>
        {list.map((g) => (
          <div key={g.id} className="card game-card hover-lift" style={{ cursor: "default" }}>
            <div className="stripes cover">
              {g.cover_url ? <img src={g.cover_url} alt="" /> : "capa do jogo"}
              <span className="off-badge">-{g.discount_pct}%</span>
            </div>
            <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
              <span className="muted" style={{ font: "var(--text-body-sm)" }}>{g.platform} · {g.region}</span>
              <span style={{ font: "600 15px/1.3 var(--font-body)", flex: 1 }}>{g.name}</span>
              <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                <span style={{ font: "400 28px/1 var(--font-display)" }}>{fmt(g.price)}</span>
                <span className="muted" style={{ font: "var(--text-body-sm)", textDecoration: "line-through" }}>{fmt(g.original_price)}</span>
              </div>
              <a className="btn btn-md btn-outline" href={g.url_affiliate} target="_blank" rel="noreferrer sponsored">Comprar na Eneba</a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
