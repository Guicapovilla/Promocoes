import type { PriceProvider } from "../types";

/**
 * Provider genérico para feeds de afiliado (Awin, Lomadee/Buscapé, Zanox...) em JSON ou CSV.
 * Configure `PRICE_FEED_<STORE>_URL` (ex.: PRICE_FEED_KABUM_URL). A oferta casa pelo `external_id`
 * (SKU/ID do produto no feed). Colunas aceitas: id|sku|product_id e price|preco|sale_price.
 */
function parseCsv(text: string): Record<string, string>[] {
  const [head, ...lines] = text.trim().split(/\r?\n/);
  const sep = head.includes(";") ? ";" : ",";
  const cols = head.split(sep).map((c) => c.trim().toLowerCase().replace(/^"|"$/g, ""));
  return lines.map((l) => Object.fromEntries(l.split(sep).map((v, i) => [cols[i], v.trim().replace(/^"|"$/g, "")])));
}

const toNumber = (v: unknown) => {
  const n = Number(String(v).replace(/[^\d.,]/g, "").replace(/\.(?=\d{3}\b)/g, "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
};

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
      const rows: Record<string, unknown>[] = text.trimStart().startsWith("[") ? JSON.parse(text) : parseCsv(text);
      const prices = new Map<string, number>();
      for (const r of rows) {
        const id = String(r.id ?? r.sku ?? r.product_id ?? "");
        const price = toNumber(r.price ?? r.preco ?? r.sale_price);
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
