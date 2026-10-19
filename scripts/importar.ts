/**
 * Puxa produtos automaticamente (Mercado Livre e Shopee) e popula o banco.
 *   npm run importar              → grava no Supabase
 *   npm run importar -- --simular → só mostra o que seria gravado (não precisa do Supabase)
 * Lista de buscas: catalogo.config.json. Cada loja só roda se as chaves dela estiverem no .env.local.
 */
import { readFileSync } from "node:fs";
import { searchMercadoLivre, type Candidate } from "../src/lib/ingest/discover-ml";
import { getToken } from "../src/lib/ingest/providers/mercadolivre";
import { searchShopee } from "../src/lib/ingest/shopee";

type Busca = { termo: string; categoria: string; precoMinimo?: number; limite?: number };
type Achado = { loja: string; source: string; busca: Busca; c: Candidate };
const simular = process.argv.includes("--simular");
const config = JSON.parse(readFileSync("catalogo.config.json", "utf8")) as { mercadolivre?: Busca[]; shopee?: Busca[] };

const slugify = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

async function coletar(loja: string, buscas: Busca[], buscar: (b: Busca) => Promise<Candidate[]>, source: string, achados: Achado[]) {
  console.log(`\n── ${loja} ──`);
  for (const busca of buscas) {
    try {
      const list = await buscar(busca);
      console.log(`✔ "${busca.termo}": ${list.length} produto(s)`);
      list.forEach((c) => achados.push({ loja, source, busca, c }));
    } catch (e) {
      console.log(`✘ "${busca.termo}": ${msg(e)}`);
    }
  }
}

async function main() {
  const achados: Achado[] = [];
  const pulou: string[] = [];

  if (process.env.ML_CLIENT_ID && process.env.ML_CLIENT_SECRET) {
    try {
      const token = (await getToken())!;
      await coletar("Mercado Livre", config.mercadolivre ?? [], (b) => searchMercadoLivre(b.termo, token, { limit: b.limite, minPrice: b.precoMinimo }), "mercadolivre", achados);
    } catch (e) { console.log(`✘ Mercado Livre: ${msg(e)}`); }
  } else pulou.push("Mercado Livre (faltam ML_CLIENT_ID e ML_CLIENT_SECRET)");

  if (process.env.SHOPEE_APP_ID && process.env.SHOPEE_SECRET) {
    await coletar("Shopee", config.shopee ?? [], (b) => searchShopee(b.termo, { limit: b.limite, minPrice: b.precoMinimo }), "shopee", achados);
  } else pulou.push("Shopee (faltam SHOPEE_APP_ID e SHOPEE_SECRET)");

  pulou.forEach((p) => console.log(`\n⚠ Pulei ${p}`));
  if (pulou.length === 2) throw new Error("Nenhuma loja configurada. Preencha as chaves no arquivo .env.local (veja o guia).");

  console.log(`\n${achados.length} produto(s) encontrados.\n`);
  achados.forEach(({ loja, c }) => console.log(`  ${brl(c.price).padStart(14)}  [${loja}] ${c.name.slice(0, 64)}`));
  if (simular || achados.length === 0) return console.log(simular ? "\n(modo simulação: nada foi gravado)" : "");

  const { createAdminClient } = await import("../src/lib/supabase/admin");
  const db = createAdminClient();
  let ok = 0;
  for (const { loja, source, busca, c } of achados) {
    const { data: p, error } = await db
      .from("products")
      .upsert({ slug: slugify(c.name), name: c.name, category: busca.categoria, image_url: c.imageUrl }, { onConflict: "slug" })
      .select("id").single();
    if (error || !p) { console.log(`✘ ${c.name}: ${error?.message}`); continue; }
    const { error: oErr } = await db.from("offers").upsert(
      {
        product_id: p.id, store: loja, price: c.price, product_url: c.url || null, external_id: c.externalId, source,
        url_affiliate: c.affiliateUrl ?? null, // Shopee já devolve o link de afiliado pronto
        fetched_at: new Date().toISOString(),
      },
      { onConflict: "product_id,store" },
    );
    if (oErr) console.log(`✘ ${c.name}: ${oErr.message}`); else ok++;
  }
  const { error: hErr } = await db.rpc("record_daily_min");
  console.log(`\n✅ ${ok} oferta(s) gravadas. ${hErr ? "Erro no histórico: " + hErr.message : "Histórico de hoje registrado."}`);
}

main().catch((e) => { console.error("\n✘ " + msg(e)); process.exit(1); });
