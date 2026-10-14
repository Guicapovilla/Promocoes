import { createAdminClient } from "../supabase/admin";
import { amazon } from "./providers/amazon";
import { feed } from "./providers/feed";
import { mercadoLivre } from "./providers/mercadolivre";
import { shopee } from "./providers/shopee";
import type { OfferRow, PriceProvider } from "./types";

const PROVIDERS: Record<string, PriceProvider> = { mercadolivre: mercadoLivre, amazon, shopee, feed };

/** Coleta preços de todas as ofertas com `source` automático, grava em `offers` e fecha o dia em `price_history`. */
export async function ingestPrices() {
  const db = createAdminClient();
  const { data, error } = await db.from("offers").select("id, product_id, store, source, external_id, price").neq("source", "manual");
  if (error) throw error;
  const offers = (data ?? []).map((o) => ({ ...o, price: Number(o.price) })) as OfferRow[];

  let updated = 0;
  const errors: string[] = [];
  for (const [name, provider] of Object.entries(PROVIDERS)) {
    const mine = offers.filter((o) => o.source === name);
    if (!mine.length) continue;
    try {
      const prices = await provider.fetchPrices(mine);
      const now = new Date().toISOString();
      for (const [id, price] of prices) {
        const { error: upErr } = await db.from("offers").update({ price, fetched_at: now }).eq("id", id);
        if (upErr) errors.push(`${name}/${id}: ${upErr.message}`);
        else updated++;
      }
    } catch (e) {
      errors.push(`${name}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  const { data: days, error: rpcErr } = await db.rpc("record_daily_min");
  if (rpcErr) errors.push(`record_daily_min: ${rpcErr.message}`);
  const { error: offErr } = await db.rpc("record_offer_prices");
  if (offErr) errors.push(`record_offer_prices: ${offErr.message}`);
  return { offers: offers.length, updated, history_rows: days ?? 0, errors };
}
