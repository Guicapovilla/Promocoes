import type { PriceProvider } from "../types";

/**
 * Amazon Creators API (substitui a PA-API 5.0, descontinuada). `external_id` = ASIN.
 * Credenciais (Associates Central > Creators API): AMAZON_CREDENTIAL_ID, AMAZON_CREDENTIAL_SECRET,
 * AMAZON_PARTNER_TAG. Brasil usa a versão NA (3.1): token em api.amazon.com. Sobrescreva com
 * AMAZON_TOKEN_ENDPOINT se a sua credencial for de outra versão. Preço vem de offersV2 (oferta da buybox).
 */
const API = "https://creatorsapi.amazon/catalog/v1/getItems";
const MARKETPLACE = process.env.AMAZON_MARKETPLACE ?? "www.amazon.com.br";

type Listing = {
  isBuyBoxWinner?: boolean;
  condition?: { value?: string };
  availability?: { type?: string };
  price?: { money?: { amount?: number } };
};

/** Escolhe o preço da oferta nova da buybox; sem buybox, a primeira oferta nova em estoque. */
export function pickAmazonPrice(listings: Listing[] | null | undefined): number | null {
  const ok = (listings ?? []).filter(
    (l) => (l.condition?.value ?? "New") === "New" && !["OUT_OF_STOCK", "UNAVAILABLE"].includes(l.availability?.type ?? "") && l.price?.money?.amount,
  );
  const chosen = ok.find((l) => l.isBuyBoxWinner) ?? ok[0];
  const amount = Number(chosen?.price?.money?.amount);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

let cached: { token: string; exp: number } | null = null;

async function accessToken(id: string, secret: string): Promise<string> {
  if (cached && cached.exp > Date.now() + 60_000) return cached.token;
  const endpoint = process.env.AMAZON_TOKEN_ENDPOINT ?? "https://api.amazon.com/auth/o2/token";
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ grant_type: "client_credentials", client_id: id, client_secret: secret, scope: "creatorsapi::default" }),
  });
  if (!res.ok) throw new Error(`token Amazon HTTP ${res.status}`);
  const body = (await res.json()) as { access_token: string; expires_in: number };
  cached = { token: body.access_token, exp: Date.now() + body.expires_in * 1000 };
  return body.access_token;
}

export const amazon: PriceProvider = {
  name: "amazon",
  async fetchPrices(offers) {
    const out = new Map<string, number>();
    const id = process.env.AMAZON_CREDENTIAL_ID;
    const secret = process.env.AMAZON_CREDENTIAL_SECRET;
    const tag = process.env.AMAZON_PARTNER_TAG;
    if (!id || !secret || !tag) return out;
    const token = await accessToken(id, secret);
    const withId = offers.filter((o) => o.external_id);
    for (let i = 0; i < withId.length; i += 10) {
      const chunk = withId.slice(i, i + 10);
      const res = await fetch(API, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "x-marketplace": MARKETPLACE },
        body: JSON.stringify({
          itemIds: chunk.map((o) => o.external_id),
          itemIdType: "ASIN",
          marketplace: MARKETPLACE,
          partnerTag: tag,
          resources: ["offersV2.listings.price", "offersV2.listings.availability", "offersV2.listings.condition", "offersV2.listings.isBuyBoxWinner"],
        }),
      });
      if (!res.ok) throw new Error(`getItems Amazon HTTP ${res.status}`);
      const body = (await res.json()) as { itemsResult?: { items?: { asin: string; offersV2?: { listings?: Listing[] } | null }[] } };
      for (const item of body.itemsResult?.items ?? []) {
        const price = pickAmazonPrice(item.offersV2?.listings);
        const offer = chunk.find((o) => o.external_id === item.asin);
        if (offer && price) out.set(offer.id, price);
      }
    }
    return out;
  },
};
