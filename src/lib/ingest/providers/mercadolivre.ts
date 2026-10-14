import type { PriceProvider } from "../types";

/** API pública do Mercado Livre: GET /items?ids=MLB1,MLB2 (até 20 por chamada). `external_id` = MLB... */
export const mercadoLivre: PriceProvider = {
  name: "mercadolivre",
  async fetchPrices(offers) {
    const out = new Map<string, number>();
    const withId = offers.filter((o) => o.external_id);
    for (let i = 0; i < withId.length; i += 20) {
      const chunk = withId.slice(i, i + 20);
      const headers: Record<string, string> = {};
      if (process.env.MERCADOLIVRE_ACCESS_TOKEN) headers.Authorization = `Bearer ${process.env.MERCADOLIVRE_ACCESS_TOKEN}`;
      const res = await fetch(`https://api.mercadolibre.com/items?ids=${chunk.map((o) => o.external_id).join(",")}&attributes=id,price,status`, { headers });
      if (!res.ok) continue;
      const body = (await res.json()) as { code: number; body: { id: string; price: number; status: string } }[];
      for (const entry of body) {
        if (entry.code !== 200 || entry.body.status !== "active") continue;
        const offer = chunk.find((o) => o.external_id === entry.body.id);
        if (offer) out.set(offer.id, entry.body.price);
      }
    }
    return out;
  },
};
