/** Descoberta de produtos no Mercado Livre por palavra-chave (GET /sites/MLB/search). */
export type Candidate = {
  key: string; // agrupa anúncios do mesmo produto (catálogo do ML) ou o próprio anúncio
  name: string;
  price: number;
  externalId: string; // MLB...
  url: string;
  imageUrl: string | null;
};

type SearchItem = {
  id: string;
  title: string;
  price: number;
  permalink: string;
  thumbnail?: string;
  condition?: string;
  catalog_product_id?: string | null;
  available_quantity?: number;
};

const https = (u?: string) => (u ? u.replace(/^http:/, "https:").replace(/-I\.jpg$/, "-O.jpg") : null);

/** Pega os resultados, ignora usados/sem estoque e fica com o anúncio mais barato de cada produto. */
export function pickCheapest(items: SearchItem[], limit: number, minPrice = 0): Candidate[] {
  const best = new Map<string, Candidate>();
  for (const it of items) {
    if (!it.id || !(it.price > minPrice) || it.condition === "used" || it.available_quantity === 0) continue;
    const key = it.catalog_product_id || it.id;
    const cur = best.get(key);
    if (!cur || it.price < cur.price) {
      best.set(key, { key, name: it.title.trim(), price: it.price, externalId: it.id, url: it.permalink.split("?")[0], imageUrl: https(it.thumbnail) });
    }
  }
  return [...best.values()].slice(0, limit);
}

export async function searchMercadoLivre(term: string, token: string, opts: { limit?: number; minPrice?: number } = {}, fetchFn: typeof fetch = fetch) {
  const limit = opts.limit ?? 5;
  const res = await fetchFn(`https://api.mercadolibre.com/sites/MLB/search?q=${encodeURIComponent(term)}&condition=new&limit=50`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Busca "${term}" falhou: HTTP ${res.status}`);
  const body = (await res.json()) as { results?: SearchItem[] };
  return pickCheapest(body.results ?? [], limit, opts.minPrice ?? 0);
}
