export type StoreMatch = { store: string; externalId: string | null; canonicalUrl: string };

export const STORES = ["Amazon", "Mercado Livre", "Shopee", "Casas Bahia", "Eneba"] as const;

/** Reconhece a loja pelo endereço colado e extrai o código do produto (ASIN, MLB..., etc.). */
export function detectStore(input: string): StoreMatch | null {
  let u: URL;
  try { u = new URL(input.trim()); } catch { return null; }
  const host = u.hostname.replace(/^www\./, "");
  const path = u.pathname;

  if (host.endsWith("amazon.com.br")) {
    const m = /\/(?:dp|gp\/product)\/([A-Z0-9]{10})/i.exec(path);
    if (!m) return null;
    return { store: "Amazon", externalId: m[1].toUpperCase(), canonicalUrl: `https://www.amazon.com.br/dp/${m[1].toUpperCase()}` };
  }
  if (host.endsWith("mercadolivre.com.br")) {
    const m = /MLB-?(\d{6,})/i.exec(path);
    if (!m) return null;
    return { store: "Mercado Livre", externalId: "MLB" + m[1], canonicalUrl: u.origin + u.pathname };
  }
  if (host.endsWith("shopee.com.br")) {
    const m = /-i\.(\d+)\.(\d+)/.exec(path) ?? /\/product\/(\d+)\/(\d+)/.exec(path);
    return { store: "Shopee", externalId: m ? `${m[1]}.${m[2]}` : null, canonicalUrl: u.origin + u.pathname };
  }
  if (host.endsWith("casasbahia.com.br")) {
    return { store: "Casas Bahia", externalId: null, canonicalUrl: u.origin + u.pathname };
  }
  if (host.endsWith("eneba.com")) {
    return { store: "Eneba", externalId: null, canonicalUrl: u.origin + u.pathname };
  }
  return null;
}
