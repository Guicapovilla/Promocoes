import { NextResponse, type NextRequest } from "next/server";
import { getProfile } from "@/lib/data";
import { liveSearch } from "@/lib/ingest/discover";
import { tokens } from "@/lib/ingest/normalize";
import { classify, hasHistory, pctVsAvg } from "@/lib/pricing";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

/** Busca do dashboard: dispara a consulta nas lojas (com cache) e responde com o catálogo já monitorado. Só apoiadores. */
export async function GET(request: NextRequest) {
  const profile = await getProfile();
  if (!profile || !(profile.is_supporter || profile.is_admin)) return NextResponse.json({ error: "não autorizado" }, { status: 401 });

  const q = (request.nextUrl.searchParams.get("q") ?? "").slice(0, 80);
  const words = tokens(q);
  if (!words.length) return NextResponse.json({ results: [], live: false });

  let live = false;
  try {
    live = (await liveSearch(q)).live;
  } catch (e) {
    console.warn("[search] busca ao vivo falhou:", e instanceof Error ? e.message : e);
  }

  // RLS: só apoiadores leem. Todas as palavras precisam estar no nome.
  const supabase = await createClient();
  let query = supabase.from("products").select("id, slug, name, image_url, offers(id, store, price)").eq("active", true);
  for (const w of words) query = query.ilike("name", `%${w}%`);
  const { data } = await query.limit(40);

  // média dos últimos 6 meses (mesma regra da home): histórico diário do menor preço
  const ids = (data ?? []).map((p: any) => p.id);
  const since = new Date(Date.now() - 180 * 86_400_000).toLocaleDateString("sv-SE");
  const { data: hist } = ids.length
    ? await supabase.from("price_history").select("product_id, min_price").in("product_id", ids).gte("date", since).limit(20000)
    : { data: [] as { product_id: string; min_price: number }[] };
  const series = new Map<string, number[]>();
  for (const h of hist ?? []) series.set(h.product_id, [...(series.get(h.product_id) ?? []), Number(h.min_price)]);

  const results = (data ?? [])
    .map((p: any) => {
      const offers = [...(p.offers ?? [])].sort((a: any, b: any) => a.price - b.price);
      if (!offers.length) return null;
      const price = Number(offers[0].price);
      const prices = series.get(p.id) ?? [];
      const days = prices.length;
      const avg = days ? prices.reduce((a, b) => a + b, 0) / days : null;
      const pct = avg && hasHistory(prices.map((x) => ({ date: "", price: x }))) ? pctVsAvg(price, avg) : null;
      return { id: p.id, slug: p.slug, name: p.name, image_url: p.image_url, price, store: offers[0].store, stores: offers.length, days, avg, pct, tone: pct == null ? null : classify(pct) };
    })
    .filter(Boolean)
    .sort((a: any, b: any) => a.price - b.price)
    .slice(0, 12);
  return NextResponse.json({ results, live });
}
