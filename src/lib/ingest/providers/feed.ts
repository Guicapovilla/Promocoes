import type { PriceProvider } from "../types";
import { toNumber, type Hit } from "../normalize";

/**
 * Provider genérico para feeds de afiliado (Awin, Lomadee/Buscapé, Zanox...) em JSON ou CSV.
 * Configure `PRICE_FEED_<STORE>_URL` (ex.: PRICE_FEED_KABUM_URL). A oferta casa pelo `external_id`
 * (SKU/ID do produto no feed). Colunas aceitas: id|sku|product_id e price|preco|sale_price.
 */
/** CSV com aspas (RFC 4180): vírgula/ponto e vírgula dentro do título não quebra a linha. */
export function parseCsv(text: string): Record<string, string>[] {
  const first = text.slice(0, text.indexOf("\n") >>> 0 || undefined);
  const sep = first.includes(";") && !first.includes(",") ? ";" : first.split(";").length > first.split(",").length ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === sep) { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((v) => v.trim())) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some((v) => v.trim())) rows.push(row);
  const [head, ...lines] = rows;
  if (!head) return [];
  const cols = head.map((c) => c.trim().toLowerCase());
  return lines.map((l) => Object.fromEntries(l.map((v, i) => [cols[i], v.trim()])));
}

const pick = (r: Record<string, unknown>, keys: string[]) => {
  for (const k of keys) if (r[k] != null && String(r[k]).trim()) return String(r[k]).trim();
  return "";
};

const parseFeed = (text: string): Record<string, unknown>[] =>
  text.trimStart().startsWith("[") ? JSON.parse(text) : parseCsv(text);

const storeName = (key: string) => process.env[`PRICE_FEED_${key}_NAME`] ?? (key === "CASASBAHIA" ? "Casas Bahia" : key.charAt(0) + key.slice(1).toLowerCase());

/** Catálogo completo de cada feed configurado (PRICE_FEED_<LOJA>_URL), já como anúncios com link de afiliado. */
export async function feedCatalogs(): Promise<Hit[]> {
  const hits: Hit[] = [];
  for (const [env, url] of Object.entries(process.env)) {
    const m = /^PRICE_FEED_([A-Z0-9]+)_URL$/.exec(env);
    if (!m || !url) continue;
    const store = storeName(m[1]);
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      for (const r of parseFeed(await res.text())) {
        const id = pick(r, ["id", "sku", "product_id", "aw_product_id"]);
        const title = pick(r, ["title", "name", "nome", "product_name", "titulo"]);
        const price = toNumber(pick(r, ["price", "preco", "sale_price", "search_price", "store_price"]));
        const link = pick(r, ["aw_deep_link", "deeplink", "deep_link", "affiliate_url", "url", "link", "product_url"]);
        if (!id || !title || !price || !link) continue;
        hits.push({
          store, source: "feed", externalId: id, title, price, url: link,
          imageUrl: pick(r, ["image_url", "image", "imagem", "aw_image_url", "merchant_image_url"]) || null,
          ean: pick(r, ["ean", "gtin", "ean_code"]) || null,
        });
      }
    } catch (e) {
      console.warn(`[ingest] feed ${store}:`, e instanceof Error ? e.message : e);
    }
  }
  return hits;
}

export const feed: PriceProvider = {
  name: "feed",
  async fetchPrices(offers) {
    const out = new Map<string, number>();
    const byStore = new Map<string, typeof offers>();
    for (const o of offers) byStore.set(o.store, [...(byStore.get(o.store) ?? []), o]);

    for (const [store, list] of byStore) {
      const key = "PRICE_FEED_" + store.toUpperCase().replace(/[^A-Z0-9]/g, "") + "_URL";
      const url = process.env[key];
      if (!url) continue;
      const res = await fetch(url);
      if (!res.ok) continue;
      const text = await res.text();
      const rows = parseFeed(text);
      const prices = new Map<string, number>();
      for (const r of rows) {
        const id = pick(r, ["id", "sku", "product_id", "aw_product_id"]);
        const price = toNumber(pick(r, ["price", "preco", "sale_price", "search_price", "store_price"]));
        if (id && price) prices.set(id, price);
      }
      for (const o of list) {
        const p = o.external_id ? prices.get(o.external_id) : undefined;
        if (p) out.set(o.id, p);
      }
    }
    return out;
  },
};
