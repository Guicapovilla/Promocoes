"use client";

import { useEffect, useRef, useState } from "react";
import { fmt } from "@/lib/format";
import { pctLabel, TONES, MIN_HISTORY_DAYS } from "@/lib/pricing";
import { SearchIcon } from "./icons";
import { PickLink } from "./pick-link";
import { useUi } from "./ui-provider";

type Item = { id: string; slug: string; name: string; price: number };
type Remote = Item & { store: string; stores: number; days: number; avg: number | null; pct: number | null; tone: "success" | "warning" | "danger" | null };

export function SearchBox({ items }: { items: Item[] }) {
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLInputElement>(null);
  const { openHelp } = useUi();
  const q = query.trim().toLowerCase();
  const words = q.split(/\s+/).filter(Boolean);
  const local = q ? items.filter((x) => words.every((w) => x.name.toLowerCase().includes(w))) : [];
  const [remote, setRemote] = useState<Remote[]>([]);
  const [loading, setLoading] = useState(false);

  // busca nas lojas (servidor consulta Shopee/Amazon e o catálogo monitorado), com debounce
  useEffect(() => {
    if (q.length < 3) { setRemote([]); setLoading(false); return; }
    setLoading(true);
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        const body = res.ok ? await res.json() : { results: [] };
        setRemote(body.results ?? []);
      } catch { /* cancelada ou sem rede: fica o resultado local */ }
      if (!ctrl.signal.aborted) setLoading(false);
    }, 400);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [q]);

  const seen = new Set(local.map((x) => x.id));
  const found: (Item & Partial<Remote>)[] = [...local, ...remote.filter((x) => !seen.has(x.id))];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName?.toLowerCase();
      if (e.key === "Escape") setQuery("");
      if (e.key === "/" && tag !== "input" && tag !== "textarea") {
        e.preventDefault();
        ref.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div style={{ position: "relative", width: "100%" }}>
      <div className="search-box">
        <SearchIcon />
        <input
          ref={ref}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && found[0]) (document.getElementById("sg-0") as HTMLAnchorElement | null)?.click();
          }}
          placeholder="Buscar produto"
          aria-label="Buscar produto"
        />
        <kbd>/</kbd>
      </div>
      {found.length > 0 && (
        <div className="dropdown suggest">
          {found.map((x, i) => (
            <PickLink key={x.id} id={`sg-${i}`} slug={x.slug} productId={x.id} price={x.price} onClick={() => setQuery("")}
              style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "12px 14px", borderRadius: "var(--radius-sm)", color: "var(--text-primary)" }}
              className="list-row">
              <span>{x.name}</span>
              <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2, whiteSpace: "nowrap" }}>
                <span className="muted">{x.store ? `${x.store}${x.stores && x.stores > 1 ? ` +${x.stores - 1}` : ""} · ` : ""}{fmt(x.price)}</span>
                {x.avg != null && x.pct != null && x.tone ? (
                  <span style={{ font: "12px/1.4 var(--font-body)", color: TONES[x.tone].ink }}>média {fmt(x.avg)} · {pctLabel(x.pct)}</span>
                ) : x.days != null ? (
                  <span className="muted" style={{ font: "12px/1.4 var(--font-body)" }}>novo · {x.days} {x.days === 1 ? "dia" : "dias"} de histórico (média a partir de {MIN_HISTORY_DAYS})</span>
                ) : null}
              </span>
            </PickLink>
          ))}
        </div>
      )}
      {q && loading && found.length === 0 && (
        <div className="dropdown suggest" style={{ padding: 16 }}>
          <span className="secondary" style={{ font: "14px/1.4 var(--font-body)" }}>Buscando nas lojas…</span>
        </div>
      )}
      {q && !loading && found.length === 0 && (
        <div className="dropdown suggest" style={{ padding: 16, gap: 10 }}>
          <span className="secondary" style={{ font: "14px/1.4 var(--font-body)" }}>Nenhum produto encontrado para “{query}”.</span>
          <button
            className="link-btn"
            style={{ alignSelf: "flex-start", minHeight: 0, padding: "6px 0" }}
            onClick={() => { openHelp("suggest", { type: "Novo produto", text: query }); setQuery(""); }}
          >
            Pedir para acompanhar este produto →
          </button>
        </div>
      )}
    </div>
  );
}
