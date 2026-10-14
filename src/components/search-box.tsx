"use client";

import { useEffect, useRef, useState } from "react";
import { fmt } from "@/lib/format";
import { SearchIcon } from "./icons";
import { PickLink } from "./pick-link";
import { useUi } from "./ui-provider";

type Item = { id: string; slug: string; name: string; price: number };

export function SearchBox({ items }: { items: Item[] }) {
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLInputElement>(null);
  const { openHelp } = useUi();
  const q = query.trim().toLowerCase();
  const found = q ? items.filter((x) => x.name.toLowerCase().includes(q)) : [];

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
              <span className="muted">{fmt(x.price)}</span>
            </PickLink>
          ))}
        </div>
      )}
      {q && found.length === 0 && (
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
