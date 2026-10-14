import { createHash } from "node:crypto";
import type { PriceProvider } from "../types";

/**
 * Shopee Affiliate Open API (GraphQL, Brasil). `external_id` = itemId do produto.
 * Credenciais: SHOPEE_APP_ID e SHOPEE_APP_SECRET (painel de afiliados > Open API).
 * Assinatura: SHA256(appId + timestamp + payload + secret), payload = corpo JSON exato enviado.
 */
const ENDPOINT = process.env.SHOPEE_API_URL ?? "https://open-api.affiliate.shopee.com.br/graphql";

export function shopeeAuthHeader(appId: string, secret: string, payload: string, timestamp: number) {
  const signature = createHash("sha256").update(appId + timestamp + payload + secret).digest("hex");
  return `SHA256 Credential=${appId}, Timestamp=${timestamp}, Signature=${signature}`;
}

type Node = { itemId?: string | number; price?: string | number; priceMin?: string | number };

/** Preço de um nó da resposta: `price` (string) ou o menor preço entre variações. */
export function shopeeNodePrice(node: Node | undefined): number | null {
  if (!node) return null;
  const n = Number(node.price ?? node.priceMin);
  return Number.isFinite(n) && n > 0 ? n : null;
}

async function queryItem(appId: string, secret: string, itemId: string): Promise<number | null> {
  if (!/^\d+$/.test(itemId)) return null;
  const payload = JSON.stringify({
    query: `{ productOfferV2(itemId: ${itemId}, limit: 1) { nodes { itemId price priceMin } } }`,
  });
  const timestamp = Math.floor(Date.now() / 1000);
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: shopeeAuthHeader(appId, secret, payload, timestamp) },
    body: payload,
  });
  if (!res.ok) return null;
  const body = (await res.json()) as { errors?: { message: string }[]; data?: { productOfferV2?: { nodes?: Node[] } } };
  if (body.errors?.length) throw new Error(body.errors[0].message);
  const nodes = body.data?.productOfferV2?.nodes ?? [];
  return shopeeNodePrice(nodes.find((n) => String(n.itemId) === itemId) ?? nodes[0]);
}

export const shopee: PriceProvider = {
  name: "shopee",
  async fetchPrices(offers) {
    const out = new Map<string, number>();
    const appId = process.env.SHOPEE_APP_ID;
    const secret = process.env.SHOPEE_APP_SECRET;
    if (!appId || !secret) return out;
    for (const o of offers) {
      if (!o.external_id) continue;
      try {
        const price = await queryItem(appId, secret, o.external_id);
        if (price) out.set(o.id, price);
      } catch (e) {
        console.warn(`[ingest] shopee ${o.external_id}:`, e instanceof Error ? e.message : e);
      }
    }
    return out;
  },
};
