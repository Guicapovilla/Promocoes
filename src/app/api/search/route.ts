import { NextResponse, type NextRequest } from "next/server";
import { getProfile } from "@/lib/data";
import { liveSearch } from "@/lib/ingest/discover";
import { tokens } from "@/lib/ingest/normalize";
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

  const results = (data ?? [])
    .map((p: any) => {
      const offers = [...(p.offers ?? [])].sort((a: any, b: any) => a.price - b.price);
      return offers.length ? { id: p.id, slug: p.slug, name: p.name, image_url: p.image_url, price: Number(offers[0].price), store: offers[0].store, stores: offers.length } : null;
    })
    .filter(Boolean)
    .sort((a: any, b: any) => a.price - b.price)
    .slice(0, 12);
  return NextResponse.json({ results, live });
}
