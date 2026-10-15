/** subid = "<userId>.<productId>" — volta no postback para atribuir a compra ao apoiador. */
export const makeSubId = (userId: string, productId: string) => `${userId}.${productId}`;

export function parseSubId(sub: string | null | undefined): { userId: string; productId: string } | null {
  const m = /^([0-9a-f-]{36})\.([0-9a-f-]{36})$/i.exec(sub ?? "");
  return m ? { userId: m[1], productId: m[2] } : null;
}

/** Substitui {subid} (ou acrescenta ?subid=) e devolve a URL final. */
export function buildAffiliateUrl(template: string, userId: string, productId: string): string {
  const sub = encodeURIComponent(makeSubId(userId, productId));
  if (template.includes("{subid}")) return template.replaceAll("{subid}", sub);
  const u = new URL(template);
  u.searchParams.set("subid", makeSubId(userId, productId));
  return u.toString();
}

/** Link de WhatsApp/contato do serviço com UTM. */
export function withUtm(url: string, campaign: string): string {
  try {
    const u = new URL(url);
    u.searchParams.set("utm_source", "central-capovilla");
    u.searchParams.set("utm_medium", "servicos");
    u.searchParams.set("utm_campaign", campaign);
    return u.toString();
  } catch {
    return url;
  }
}

export type Program = { append_params: string | null; link_template: string | null } | null;

/**
 * Link final do clique. Ordem de prioridade:
 *  1) link manual da oferta (override);
 *  2) modelo completo do programa ({url}, {url_encoded}, {external_id}, {subid});
 *  3) endereço do produto + parâmetros do programa (ex.: tag=seucodigo-20);
 *  4) endereço do produto sem alteração.
 */
export function resolveAffiliateUrl(
  offer: { url_affiliate: string | null; product_url: string | null; external_id: string | null },
  program: Program,
  userId: string,
  productId: string,
): string | null {
  const sub = makeSubId(userId, productId);
  if (offer.url_affiliate) return buildAffiliateUrl(offer.url_affiliate, userId, productId);
  if (!offer.product_url) return null;
  if (program?.link_template) {
    return program.link_template
      .replaceAll("{url_encoded}", encodeURIComponent(offer.product_url))
      .replaceAll("{url}", offer.product_url)
      .replaceAll("{external_id}", offer.external_id ?? "")
      .replaceAll("{subid}", encodeURIComponent(sub));
  }
  if (program?.append_params) {
    const u = new URL(offer.product_url);
    new URLSearchParams(program.append_params.replace(/^[?&]/, "")).forEach((v, k) => u.searchParams.set(k, v));
    return u.toString();
  }
  return offer.product_url;
}
