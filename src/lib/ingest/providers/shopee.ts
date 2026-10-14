import { createHash } from "node:crypto";
import type { PriceProvider } from "../types";
import type { Hit } from "../normalize";

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

type Node = {
  itemId?: string | number;
  price?: string | number;
  priceMin?: string | number;
  productName?: string;
  imageUrl?: string;
  offerLink?: string;
  productLink?: string;
};

/** Preço de um nó da resposta: `price` (string) ou o menor preço entre variações. */
export function shopeeNodePrice(node: Node | undefined): number | null {
  if (!node) return null;
  const n = Number(node.price ?? node.priceMin);
  return Number.isFinite(n) && n > 0 ? n : null;
}

async function gql(appId: string, secret: string, query: string): Promise<Node[]> {
  const payload = JSON.stringify({ query });
  const timestamp = Math.floor(Date.now() / 1000);
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: shopeeAuthHeader(appId, secret, payload, timestamp) },
    body: payload,
  });
  if (!res.ok) throw new Error(`Shopee HTTP ${res.status}`);
  const body = (await res.json()) as { errors?: { message: string }[]; data?: { productOfferV2?: { nodes?: Node[] } } };
  if (body.errors?.length) throw new Error(body.errors[0].message);
  return body.data?.productOfferV2?.nodes ?? [];
}

async function queryItem(appId: string, secret: string, itemId: string): Promise<number | null> {
  if (!/^\d+$/.test(itemId)) return null;
  const nodes = await gql(appId, secret, `{ productOfferV2(itemId: ${itemId}, limit: 1) { nodes { itemId price priceMin } } }`);
  return shopeeNodePrice(nodes.find((n) => String(n.itemId) === itemId) ?? nodes[0]);
}

/** Busca por palavra-chave. `offerLink` já carrega o seu ID de afiliado. Sem credenciais, devolve []. */
export async function shopeeSearch(keyword: string, limit = 20): Promise<Hit[]> {
  const appId = process.env.SHOPEE_APP_ID;
  const secret = process.env.SHOPEE_APP_SECRET;
  if (!appId || !secret) return [];
  const nodes = await gql(
    appId,
    secret,
    `{ productOfferV2(keyword: ${JSON.stringify(keyword)}, limit: ${limit}, sortType: 1) { nodes { itemId productName price priceMin imageUrl offerLink productLink } } }`,
  );
  const hits: Hit[] = [];
  for (const n of nodes) {
    const price = shopeeNodePrice(n);
    const url = n.offerLink || n.productLink;
    if (!n.itemId || !n.productName || !price || !url) continue;
    hits.push({ store: "Shopee", source: "shopee", externalId: String(n.itemId), title: n.productName, price, imageUrl: n.imageUrl ?? null, url });
  }
  return hits;
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
