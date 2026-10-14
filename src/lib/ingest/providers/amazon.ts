import type { PriceProvider } from "../types";

/**
 * Amazon PA-API 5.0 exige assinatura AWS SigV4 e credenciais de afiliado aprovadas
 * (AMAZON_ACCESS_KEY, AMAZON_SECRET_KEY, AMAZON_PARTNER_TAG). Ainda não implementado: ofertas
 * com source = 'amazon' ficam com o preço manual até este provider ser preenchido.
 * Implemente `GetItems` (até 10 ASINs por chamada, `external_id` = ASIN) e devolva Offers.Listings[0].Price.Amount.
 */
export const amazon: PriceProvider = {
  name: "amazon",
  async fetchPrices() {
    if (!process.env.AMAZON_ACCESS_KEY) return new Map();
    console.warn("[ingest] provider amazon ainda não implementado");
    return new Map();
  },
};
