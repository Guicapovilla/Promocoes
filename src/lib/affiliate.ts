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
