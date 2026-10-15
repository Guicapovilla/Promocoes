/**
 * Puxa produtos automaticamente e popula o banco.
 *   npm run importar            → grava no Supabase
 *   npm run importar -- --simular → só mostra o que seria gravado (não precisa do Supabase)
 * Lista de buscas: catalogo.config.json
 */
import { readFileSync } from "node:fs";
import { searchMercadoLivre, type Candidate } from "../src/lib/ingest/discover-ml";
import { getToken } from "../src/lib/ingest/providers/mercadolivre";

type Busca = { termo: string; categoria: string; precoMinimo?: number; limite?: number };
const simular = process.argv.includes("--simular");
const config = JSON.parse(readFileSync("catalogo.config.json", "utf8")) as { mercadolivre: Busca[] };

const slugify = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

async function main() {
  const token = await getToken();
  if (!token) throw new Error("Faltam ML_CLIENT_ID e ML_CLIENT_SECRET no arquivo .env.local (veja o guia, Parte 2).");

  const found: { busca: Busca; c: Candidate }[] = [];
  for (const busca of config.mercadolivre) {
    try {
      const list = await searchMercadoLivre(busca.termo, token, { limit: busca.limite, minPrice: busca.precoMinimo });
      console.log(`✔ "${busca.termo}": ${list.length} produto(s)`);
      list.forEach((c) => found.push({ busca, c }));
    } catch (e) {
      console.log(`✘ "${busca.termo}": ${e instanceof Error ? e.message : e}`);
    }
  }
  console.log(`\n${found.length} produto(s) encontrados.\n`);
  found.forEach(({ c }) => console.log(`  ${brl(c.price).padStart(14)}  ${c.name.slice(0, 70)}  (${c.externalId})`));
  if (simular || found.length === 0) return console.log(simular ? "\n(modo simulação: nada foi gravado)" : "");

  const { createAdminClient } = await import("../src/lib/supabase/admin");
  const db = createAdminClient();
  let ok = 0;
  for (const { busca, c } of found) {
    const slug = slugify(c.name);
    const { data: p, error } = await db
      .from("products")
      .upsert({ slug, name: c.name, category: busca.categoria, image_url: c.imageUrl }, { onConflict: "slug" })
      .select("id").single();
    if (error || !p) { console.log(`✘ ${c.name}: ${error?.message}`); continue; }
    const { error: oErr } = await db.from("offers").upsert(
      { product_id: p.id, store: "Mercado Livre", price: c.price, product_url: c.url, external_id: c.externalId, source: "mercadolivre", url_affiliate: null, fetched_at: new Date().toISOString() },
      { onConflict: "product_id,store" },
    );
    if (oErr) console.log(`✘ ${c.name}: ${oErr.message}`); else ok++;
  }
  const { error: hErr } = await db.rpc("record_daily_min");
  console.log(`\n✅ ${ok} oferta(s) gravadas. ${hErr ? "Erro no histórico: " + hErr.message : "Histórico de hoje registrado."}`);
}

main().catch((e) => { console.error("\n✘ " + (e instanceof Error ? e.message : e)); process.exit(1); });
