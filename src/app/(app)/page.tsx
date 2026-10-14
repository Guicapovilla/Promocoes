import Link from "next/link";
import { Deals, type Deal } from "@/components/deals";
import { Featured, type CatalogItem } from "@/components/featured";
import { PickLink } from "@/components/pick-link";
import { SearchBox } from "@/components/search-box";
import { EconomyCard } from "@/components/economy-card";
import { VideoBanner } from "@/components/video-banner";
import { getCatalog, getEvents, getGames, getRadar } from "@/lib/data";
import { fmt, fmtUpdated } from "@/lib/format";
import { autoTarget, isYearLow, markerPos, stats } from "@/lib/pricing";

export default async function PromoPage({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const { p: slug } = await searchParams;
  const [{ products, updatedAt }, radar, events, games] = await Promise.all([getCatalog(slug), getRadar(), getEvents(), getGames()]);

  if (products.length === 0) {
    return (
      <div className="page">
        <h1 className="h1">Oportunidades do dia</h1>
        <p className="sub">Ainda não há produtos com preço coletado. Rode a coleta (<code>/api/cron/prices</code>) ou carregue o <code>supabase/seed.sql</code>.</p>
      </div>
    );
  }

  const rows = products.map((x) => {
    const st = stats(x.series, 180);
    return { x, st, yearLow: isYearLow(x.series) };
  });
  // destaque: o produto pedido ou, por padrão, a maior queda vs. a média de 6 meses
  const byPct = [...rows].sort((a, b) => a.st.pct - b.st.pct);
  const sel = rows.find((r) => r.x.slug === slug) ?? byPct[0];

  const deals: Deal[] = rows
    .filter((r) => r.st.tone !== "danger" && r.x.id !== sel.x.id)
    .map(({ x, st, yearLow }) => ({
      id: x.id, slug: x.slug, name: x.name, store: x.store, price: x.price, tone: st.tone, pct: st.pct,
      pos: markerPos(x.price, st.min, st.max, 4, 96), yearLow, rec: !!x.rec_note, imageUrl: x.image_url,
      likes: x.likes, rating: x.rating, popularity: x.popularity,
    }));

  const radarBy = new Map(radar.map((r) => [r.product_id, r]));
  const hitList = rows.filter(({ x, st }) => {
    const r = radarBy.get(x.id);
    return r && x.price <= (r.target_price ?? autoTarget(st.avg));
  });
  const lows = rows.filter((r) => r.yearLow);
  const drops = rows.filter(({ x }) => x.series.length > 1 && x.price < x.series[x.series.length - 2].price);
  const short = (list: typeof rows) =>
    list.length ? list.slice(0, 2).map((r) => r.x.name).join(", ") + (list.length > 2 ? ` e mais ${list.length - 2}` : "") : "Nenhum hoje";
  const daily = [
    { label: "No alvo do seu radar", list: hitList, dot: "var(--green)", href: "/radar" },
    { label: "Menor preço do ano", list: lows, dot: "var(--primary-600)" },
    { label: "Caíram desde ontem", list: drops, dot: "#d99a00" },
  ];

  const catalog: CatalogItem[] = products.map((x) => ({ id: x.id, slug: x.slug, name: x.name, price: x.price }));
  const nextEvent = events.find((e) => /black friday/i.test(e.name)) ?? events[0];
  const x = sel.x;

  return (
    <>
      <VideoBanner />
      <div style={{ display: "flex", flexDirection: "column", gap: 24, animation: "cpFadeUp 380ms 80ms ease-out both" }}>
        <div className="page-head" style={{ paddingTop: 16 }}>
          <div>
            <h1 className="h1">Oportunidades do dia</h1>
            <p className="sub">O preço de hoje comparado com o histórico dos últimos meses.</p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end", flex: 1, minWidth: 260, maxWidth: 400 }}>
            <SearchBox items={catalog} />
            {updatedAt && <span className="live"><i />Atualizado às {fmtUpdated(updatedAt)}</span>}
          </div>
        </div>

        <div className="daily">
          {daily.map((d) => {
            const first = d.list[0];
            const inner = (
              <>
                <span className="lbl"><span className="dot" style={{ background: d.dot }} />{d.label}</span>
                <span className="num">{d.list.length}</span>
                <span className="desc">{short(d.list)}</span>
              </>
            );
            if (d.href) return <Link key={d.label} href={d.href} className="daily-card">{inner}</Link>;
            return first ? (
              <PickLink key={d.label} slug={first.x.slug} productId={first.x.id} price={first.x.price} className="daily-card">{inner}</PickLink>
            ) : (
              <div key={d.label} className="daily-card" style={{ cursor: "default" }}>{inner}</div>
            );
          })}
          <EconomyCard />
        </div>

        <Featured
          p={{
            id: x.id, name: x.name, category: x.category, imageUrl: x.image_url, recNote: x.rec_note, recVideoTitle: x.rec_video_title,
            recVideoUrl: x.rec_video_url, bfDropPct: x.bf_drop_pct, series: x.series, price: x.price, store: x.store, offerId: x.offerId,
            offers: x.offers.map((o) => ({ id: o.id, store: o.store, price: o.price })),
          }}
          catalog={catalog}
          event={nextEvent ? { name: nextEvent.name, days: nextEvent.days } : undefined}
        />

        {deals.length > 0 && <Deals deals={deals} />}

        {events.length > 0 && (
          <div className="section">
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <h2 className="h2">Próximas datas de promoção</h2>
              <p className="sub-sm">Previsão com base no histórico: quanto cada produto caiu na mesma data em {new Date().getFullYear() - 1}.</p>
            </div>
            <div className="grid-fill" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(240px, 100%), 1fr))" }}>
              {events.map((e) => (
                <div key={e.id} className="card event-card">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <span style={{ font: "600 15px/1.3 var(--font-body)" }}>{e.name}</span>
                      <span className="muted" style={{ font: "12px/1.3 var(--font-body)" }}>{e.date} · previsão</span>
                    </div>
                    <span className="pill" style={{ font: "600 12px/1 var(--font-body)", color: "var(--secondary-700)", background: "var(--secondary-100)", padding: "6px 9px" }}>
                      em {e.days} {e.days === 1 ? "dia" : "dias"}
                    </span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2, borderTop: "1px solid var(--border-subtle)", paddingTop: 10 }}>
                    <span className="muted" style={{ font: "12px/1 var(--font-body)", paddingBottom: 6 }}>Queda em {new Date().getFullYear() - 1}</span>
                    {e.items.map((it) => (
                      <div key={it.name} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "5px 0", font: "13px/1.3 var(--font-body)" }}>
                        <span className="secondary">{it.name}</span>
                        <span style={{ fontWeight: 600, color: "var(--green-ink)", whiteSpace: "nowrap" }}>-{it.drop}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {games.length > 0 && (
          <div className="section">
            <div className="section-head">
              <div>
                <h2 className="h2">Jogos em desconto</h2>
                <p className="sub-sm">Chaves digitais via Eneba.</p>
              </div>
              <Link href="/jogos" className="link-btn" style={{ display: "inline-flex", alignItems: "center" }}>Ver todos os jogos →</Link>
            </div>
            <div className="grid-fill" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(min(260px, 100%), 1fr))" }}>
              {[...games].sort((a, b) => b.popularity - a.popularity).slice(0, 4).map((g) => (
                <a key={g.id} href={g.url_affiliate} target="_blank" rel="noreferrer sponsored" className="card game-mini hover-lift">
                  <div className="stripes" style={{ width: 64, aspectRatio: "3/4", flexShrink: 0, borderRadius: "var(--radius-sm)" }}>
                    {g.cover_url && <img src={g.cover_url} alt="" />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
                    <span style={{ font: "600 14px/1.3 var(--font-body)", color: "var(--text-primary)" }}>{g.name}</span>
                    <span className="muted" style={{ font: "12px/1.3 var(--font-body)" }}>{g.platform}</span>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <span style={{ font: "400 22px/1 var(--font-display)", color: "var(--text-primary)" }}>{fmt(g.price)}</span>
                      <span style={{ font: "700 11px/1 var(--font-body)", color: "#fff", background: "var(--green)", padding: "4px 6px", borderRadius: 4 }}>-{g.discount_pct}%</span>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
