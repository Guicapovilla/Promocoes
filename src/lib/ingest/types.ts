export type OfferRow = { id: string; product_id: string; store: string; source: string; external_id: string | null; price: number };

/** Um provider sabe buscar o preço atual de uma oferta. Devolve null se não achar/indisponível. */
export interface PriceProvider {
  name: string;
  /** Retorna preços por id da oferta. Deve ser tolerante: erros por item não derrubam o lote. */
  fetchPrices(offers: OfferRow[]): Promise<Map<string, number>>;
}
