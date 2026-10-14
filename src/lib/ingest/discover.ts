import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "../supabase/admin";
import { displayName, matchesQuery, matchKey, passesRule, slugify, tokens, type Hit, type WatchRule } from "./normalize";
import { amazonSearch } from "./providers/amazon";
import { feedCatalogs } from "./providers/feed";
import { shopeeSearch } from "./providers/shopee";

type Row = WatchRule & { id: string };

/**
 * Grava anúncios como produto + oferta (um produto por título normalizado, uma oferta por loja).
 * Se a loja já tem oferta para o produto, mantém a de menor preço. Devolve quantos produtos/ofertas mudaram.
 */
export async function upsertHits(db: SupabaseClient, hits: Hit[], category: string) {
  if (!hits.length) return { products: 0, offers: 0 };
  const keyed = hits.map((h) => ({ h, key: matchKey(h.title) })).filter((x) => x.key);
  const keys = [...new Set(keyed.map((x) => x.key))];
  const eans = [...new Set(keyed.map((x) => x.h.ean).filter((e): e is string => !!e))];

  const byKey = new Map<string, string>();
  const byEan = new Map<string, string>();
  for (let i = 0; i < keys.length; i += 100) {
    const { data } = await db.from("products").select("id, match_key").in("match_key", keys.slice(i, i + 100));
    for (const p of data ?? []) byKey.set(p.match_key, p.id);
  }
  for (let i = 0; i < eans.length; i += 100) {
    const { data } = await db.from("products").select("id, ean").in("ean", eans.slice(i, i + 100));
    for (const p of data ?? []) byEan.set(p.ean, p.id);
  }

  let products = 0, offers = 0;
  const now = new Date().toISOString();
  for (const { h, key } of keyed) {
    let productId = (h.ean && byEan.get(h.ean)) || byKey.get(key);
    if (!productId) {
      const { data, error } = await db
        .from("products")
        .insert({ slug: slugify(h.title), name: displayName(h.title), category, image_url: h.imageUrl, match_key: key, ean: h.ean ?? null, auto: true })
        .select("id")
        .single();
      if (error || !data) {
        // corrida com outra execução: o slug é determinístico, então reaproveita o existente
        const { data: again } = await db.from("products").select("id").eq("slug", slugify(h.title)).maybeSingle();
        if (!again) continue;
        productId = again.id;
      } else {
        productId = data.id;
        products++;
      }
      byKey.set(key, productId!);
      if (h.ean) byEan.set(h.ean, productId!);
    }

    const { data: cur } = await db.from("offers").select("id, price, external_id").eq("product_id", productId).eq("store", h.store).maybeSingle();
    if (cur && cur.external_id !== h.externalId && Number(cur.price) <= h.price) continue; // já temos um anúncio mais barato dessa loja
    const row = { product_id: productId, store: h.store, price: h.price, url_affiliate: h.url, source: h.source, external_id: h.externalId, fetched_at: now };
    const { error } = cur ? await db.from("offers").update(row).eq("id", cur.id) : await db.from("offers").insert(row);
    if (!error) offers++;
  }
  return { products, offers };
}

/** Fecha o dia: menor preço por produto e preço por loja (histórico). */
export async function closeDay(db: SupabaseClient) {
  await db.rpc("record_daily_min");
  await db.rpc("record_offer_prices");
}

/** Busca o termo em todas as lojas configuradas e devolve só os anúncios que passam nas regras. */
export async function searchStores(rule: WatchRule, feedHits: Hit[]): Promise<{ hits: Hit[]; errors: string[] }> {
  const errors: string[] = [];
  const settled = await Promise.allSettled([shopeeSearch(rule.term, 30), amazonSearch(rule.term, 10)]);
  const live: Hit[] = [];
  settled.forEach((r, i) => (r.status === "fulfilled" ? live.push(...r.value) : errors.push(`${["shopee", "amazon"][i]}: ${r.reason instanceof Error ? r.reason.message : r.reason}`)));
  const words = tokens(rule.term);
  const fromFeeds = feedHits.filter((h) => words.every((w) => tokens(h.title).includes(w)) || rule.aliases.some((a) => tokens(a).every((w) => tokens(h.title).includes(w))));
  return { hits: [...live, ...fromFeeds].filter((h) => passesRule(h, rule)), errors };
}

/** Cron: roda a lista de monitoramento inteira, grava, fecha o dia e remove anúncios mortos. */
export async function discoverAll() {
  const db = createAdminClient();
  const { data, error } = await db.from("watchlist").select("*").eq("active", true);
  if (error) throw error;
  const feedHits = await feedCatalogs(); // lido uma vez por execução
  const report: { term: string; found: number; products: number; offers: number; errors: string[] }[] = [];
  for (const w of (data ?? []) as Row[]) {
    const { hits, errors } = await searchStores(w, feedHits);
    const r = await upsertHits(db, hits, w.category);
    await db.from("watchlist").update({ last_run_at: new Date().toISOString() }).eq("id", w.id);
    report.push({ term: w.term, found: hits.length, ...r, errors });
  }
  await closeDay(db);
  const { data: pruned } = await db.rpc("prune_stale_offers", { days: 7 });
  return { terms: report.length, report, pruned: pruned ?? 0, feed_items: feedHits.length };
}

const CACHE_MIN = 30;
const maxLivePerHour = () => Number(process.env.LIVE_SEARCH_PER_HOUR ?? 120);

/**
 * Busca digitada pelo usuário: consulta Shopee/Amazon na hora (com cache de 30 min e teto por hora),
 * grava o que achou como produto monitorado e devolve true se bateu nas lojas.
 * Os feeds (Casas Bahia etc.) já estão no banco pela descoberta noturna, então não entram aqui.
 */
export async function liveSearch(query: string): Promise<{ live: boolean; added: number }> {
  const q = tokens(query).join(" ");
  if (q.length < 3) return { live: false, added: 0 };
  const db = createAdminClient();
  const since = new Date(Date.now() - CACHE_MIN * 60_000).toISOString();
  const { data: cached } = await db.from("search_cache").select("query").eq("query", q).gte("fetched_at", since).maybeSingle();
  if (cached) return { live: false, added: 0 };
  const { count } = await db.from("search_cache").select("query", { count: "exact", head: true }).gte("fetched_at", new Date(Date.now() - 3_600_000).toISOString());
  if ((count ?? 0) >= maxLivePerHour()) return { live: false, added: 0 };

  const settled = await Promise.allSettled([shopeeSearch(query, 20), amazonSearch(query, 10)]);
  const hits = settled.flatMap((r) => (r.status === "fulfilled" ? r.value : [])).filter((h) => matchesQuery(h.title, query));
  const { offers } = await upsertHits(db, hits, "Busca");
  if (hits.length) await closeDay(db);
  await db.from("search_cache").upsert({ query: q, fetched_at: new Date().toISOString(), hits: hits.length });
  return { live: true, added: offers };
}
