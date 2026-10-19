import { createHash } from "node:crypto";
import type { Candidate } from "./discover-ml";
import type { OfferRow, PriceProvider } from "./types";

/**
 * Shopee Affiliate Open API (Brasil) — GraphQL.
 * Endpoint e assinatura vêm da documentação do SDK público; os NOMES DOS CAMPOS do GraphQL não foram
 * confirmados na documentação oficial. Se a Shopee recusar algum campo, a mensagem de erro aparece no terminal:
 * ajuste FIELDS abaixo (ou rode `npm run shopee:schema` para listar os campos reais).
 */
const ENDPOINT = process.env.SHOPEE_ENDPOINT || "https://open-api.affiliate.shopee.com.br/graphql";

export const FIELDS = "itemId shopId productName price priceMin productLink offerLink imageUrl shopName";

/** Authorization: SHA256 Credential=<AppId>, Timestamp=<unix s>, Signature=sha256(AppId + Timestamp + Payload + Secret) */
export function signRequest(appId: string, secret: string, payload: string, timestamp: number) {
  const signature = createHash("sha256").update(appId + timestamp + payload + secret).digest("hex");
  return `SHA256 Credential=${appId}, Timestamp=${timestamp}, Signature=${signature}`;
}

export async function shopeeGraphql<T = unknown>(query: string, fetchFn: typeof fetch = fetch, now = () => Math.floor(Date.now() / 1000)): Promise<T> {
  const appId = process.env.SHOPEE_APP_ID, secret = process.env.SHOPEE_SECRET;
  if (!appId || !secret) throw new Error("Faltam SHOPEE_APP_ID e SHOPEE_SECRET no arquivo .env.local");
  const payload = JSON.stringify({ query });
  const res = await fetchFn(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: signRequest(appId, secret, payload, now()) },
    body: payload,
  });
  const text = await res.text();
  let body: { data?: T; errors?: { message: string }[] } = {};
  try { body = JSON.parse(text); } catch { /* resposta não-JSON */ }
  if (!res.ok || body.errors?.length) {
    throw new Error(`Shopee: ${body.errors?.map((e) => e.message).join("; ") || `HTTP ${res.status} ${text.slice(0, 200)}`}`);
  }
  return body.data as T;
}

type Node = {
  itemId: string | number; shopId?: string | number; productName: string;
  price?: string | number; priceMin?: string | number; productLink?: string; offerLink?: string; imageUrl?: string;
};

const num = (v: unknown) => { const n = Number(String(v ?? "").replace(",", ".")); return Number.isFinite(n) ? n : 0; };

export function parseShopeeNodes(nodes: Node[], limit: number, minPrice = 0): Candidate[] {
  const out: Candidate[] = [];
  for (const n of nodes) {
    const price = num(n.price) || num(n.priceMin);
    if (!n.itemId || !n.productName || !n.offerLink || !(price > minPrice)) continue;
    out.push({
      key: `${n.shopId ?? ""}.${n.itemId}`, name: n.productName.trim(), price,
      externalId: `${n.shopId ?? ""}.${n.itemId}`, url: (n.productLink ?? "").split("?")[0], imageUrl: n.imageUrl ?? null,
      affiliateUrl: n.offerLink,
    });
    if (out.length >= limit) break;
  }
  return out;
}

export async function searchShopee(term: string, opts: { limit?: number; minPrice?: number } = {}, fetchFn: typeof fetch = fetch) {
  const limit = Math.min(50, Math.max(1, opts.limit ?? 5));
  const q = `{ productOfferV2(keyword: ${JSON.stringify(term)}, page: 1, limit: 50) { nodes { ${FIELDS} } } }`;
  const data = await shopeeGraphql<{ productOfferV2: { nodes: Node[] } }>(q, fetchFn);
  return parseShopeeNodes(data.productOfferV2?.nodes ?? [], limit, opts.minPrice ?? 0);
}

/** Atualiza preços das ofertas com source = 'shopee' (external_id = "<shopId>.<itemId>"). */
export const shopee: PriceProvider = {
  name: "shopee",
  async fetchPrices(offers: OfferRow[]) {
    const out = new Map<string, number>();
    for (const o of offers) {
      const [shopId, itemId] = (o.external_id ?? "").split(".");
      if (!shopId || !itemId) continue;
      const q = `{ productOfferV2(shopId: ${Number(shopId)}, itemId: ${Number(itemId)}) { nodes { ${FIELDS} } } }`;
      const data = await shopeeGraphql<{ productOfferV2: { nodes: Node[] } }>(q);
      const n = data.productOfferV2?.nodes?.[0];
      const price = n ? num(n.price) || num(n.priceMin) : 0;
      if (price > 0) out.set(o.id, price);
    }
    return out;
  },
};
