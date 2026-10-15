import type { PriceProvider } from "../types";

let cached: { token: string; exp: number } | null = null;

/** Token de aplicativo (client_credentials). Crie o app em developers.mercadolivre.com.br e preencha ML_CLIENT_ID/ML_CLIENT_SECRET. */
export async function getToken(): Promise<string | null> {
  const id = process.env.ML_CLIENT_ID, secret = process.env.ML_CLIENT_SECRET;
  if (!id || !secret) return null;
  if (cached && cached.exp > Date.now() + 60_000) return cached.token;
  const res = await fetch("https://api.mercadolibre.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({ grant_type: "client_credentials", client_id: id, client_secret: secret }),
  });
  if (!res.ok) throw new Error(`Mercado Livre: token recusado (${res.status})`);
  const j = (await res.json()) as { access_token: string; expires_in: number };
  cached = { token: j.access_token, exp: Date.now() + j.expires_in * 1000 };
  return cached.token;
}

/** GET /items?ids=MLB1,MLB2 (até 20 por chamada). Ofertas com source = 'mercadolivre' e external_id = MLB... */
export const mercadoLivre: PriceProvider = {
  name: "mercadolivre",
  async fetchPrices(offers) {
    const out = new Map<string, number>();
    const withId = offers.filter((o) => o.external_id);
    const token = await getToken();
    if (!token) throw new Error("Mercado Livre: defina ML_CLIENT_ID e ML_CLIENT_SECRET");
    for (let i = 0; i < withId.length; i += 20) {
      const chunk = withId.slice(i, i + 20);
      const res = await fetch(`https://api.mercadolibre.com/items?ids=${chunk.map((o) => o.external_id).join(",")}&attributes=id,price,status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Mercado Livre: ${res.status}`);
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
