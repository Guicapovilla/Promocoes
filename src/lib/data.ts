import { cache } from "react";
import { createClient } from "./supabase/server";
import { daysBetween, todayISO } from "./format";
import type { AppNotification, Game, Product, Profile, PromoEvent, Purchase, RadarItem, Service } from "./types";

const num = (v: unknown) => Number(v);

export const getUser = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user;
});

export const getProfile = cache(async (): Promise<Profile | null> => {
  const user = await getUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("*").eq("user_id", user.id).single();
  return (data as Profile) ?? null;
});

const CATALOG_CAP = 300;

/** Lê todas as páginas de uma consulta (o PostgREST corta em 1000 linhas por resposta). */
async function fetchAll<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; from < 200_000; from += 1000) {
    const { data } = await page(from, from + 999);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

/**
 * Catálogo com ofertas e 365 dias de histórico. O RLS devolve vazio para quem não é apoiador.
 * Como a descoberta automática faz o catálogo crescer, a home carrega os {CATALOG_CAP} mais populares
 * (mais o produto pedido por `slug`, mesmo fora do teto).
 */
export const getCatalog = cache(async (slug?: string): Promise<{ products: Product[]; updatedAt: Date | null }> => {
  const supabase = await createClient();
  const since = new Date(Date.now() - 365 * 86_400_000).toLocaleDateString("sv-SE");
  const { data: top } = await supabase.from("products").select("*").eq("active", true).order("popularity", { ascending: false }).order("created_at", { ascending: false }).limit(CATALOG_CAP);
  const prodRows = [...(top ?? [])];
  if (slug && !prodRows.some((p) => p.slug === slug)) {
    const { data: extra } = await supabase.from("products").select("*").eq("active", true).eq("slug", slug).maybeSingle();
    if (extra) prodRows.push(extra);
  }
  // produtos do radar do usuário sempre entram, mesmo fora do teto
  const { data: mine } = await supabase.from("radar").select("product_id");
  const missing = (mine ?? []).map((r) => r.product_id).filter((id) => !prodRows.some((p) => p.id === id));
  if (missing.length) {
    const { data: extra } = await supabase.from("products").select("*").eq("active", true).in("id", missing);
    prodRows.push(...(extra ?? []));
  }
  const ids = prodRows.map((p) => p.id);
  const [offerRows, histRows] = await Promise.all([
    fetchAll((a, b) => supabase.from("offers").select("id, product_id, store, price, fetched_at").in("product_id", ids).range(a, b)),
    fetchAll((a, b) => supabase.from("price_history").select("product_id, date, min_price").in("product_id", ids).gte("date", since).order("date").range(a, b)),
  ]);
  const prods = { data: prodRows };
  const offers = { data: offerRows };
  const hist = { data: histRows };

  const offersBy = new Map<string, Product["offers"]>();
  let updatedAt: Date | null = null;
  for (const o of offers.data ?? []) {
    const list = offersBy.get(o.product_id) ?? [];
    list.push({ id: o.id, store: o.store, price: num(o.price), fetched_at: o.fetched_at });
    offersBy.set(o.product_id, list);
    const t = new Date(o.fetched_at);
    if (!updatedAt || t > updatedAt) updatedAt = t;
  }
  const histBy = new Map<string, Product["series"]>();
  for (const h of hist.data ?? []) {
    const list = histBy.get(h.product_id) ?? [];
    list.push({ date: h.date, price: num(h.min_price) });
    histBy.set(h.product_id, list);
  }

  const products: Product[] = [];
  for (const p of prods.data ?? []) {
    const offs = (offersBy.get(p.id) ?? []).sort((a, b) => a.price - b.price);
    const series = histBy.get(p.id) ?? [];
    if (!offs.length || !series.length) continue;
    // o último ponto da série reflete a oferta mais barata de agora
    const today = todayISO();
    const last = series[series.length - 1];
    if (last.date === today) last.price = offs[0].price;
    else series.push({ date: today, price: offs[0].price });
    products.push({
      ...p,
      rating: num(p.rating),
      offers: offs,
      series,
      price: offs[0].price,
      store: offs[0].store,
      offerId: offs[0].id,
    });
  }
  return { products, updatedAt };
});

export async function getRadar(): Promise<RadarItem[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("radar").select("product_id, notify, target_price").order("created_at");
  return (data ?? []).map((r) => ({ ...r, target_price: r.target_price == null ? null : num(r.target_price) }));
}

export async function getPurchases(): Promise<Purchase[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("purchases").select("id, name, paid, avg_at_purchase, date").order("date", { ascending: false });
  return (data ?? []).map((p) => ({ ...p, paid: num(p.paid), avg_at_purchase: num(p.avg_at_purchase) }));
}

export async function getGames(): Promise<Game[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("games").select("*").gt("discount_pct", 0);
  return (data ?? []).map((g) => ({ ...g, price: num(g.price), original_price: num(g.original_price), rating: num(g.rating) }));
}

export async function getServices(): Promise<Service[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("services").select("*").eq("active", true).order("sort");
  return (data ?? []).map((s) => ({ ...s, price_from: num(s.price_from) }));
}

export async function getEvents(): Promise<PromoEvent[]> {
  const supabase = await createClient();
  const today = todayISO();
  const { data } = await supabase
    .from("events")
    .select("id, name, date, event_drops(drop_pct, products(name))")
    .gte("date", today)
    .order("date")
    .limit(4);
  return (data ?? []).map((e: any) => ({
    id: e.id,
    name: e.name,
    date: e.date.slice(8, 10) + "/" + e.date.slice(5, 7),
    days: daysBetween(today, e.date),
    items: (e.event_drops ?? [])
      .map((d: any) => ({ name: d.products?.name ?? "", drop: d.drop_pct }))
      .sort((a: any, b: any) => b.drop - a.drop)
      .slice(0, 3),
  }));
}

export async function getNotifications(): Promise<AppNotification[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("notifications")
    .select("id, title, body, product_id, created_at")
    .is("read_at", null)
    .order("created_at", { ascending: false })
    .limit(3);
  return data ?? [];
}
