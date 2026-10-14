import { NextResponse } from "next/server";
import { parseSubId } from "@/lib/affiliate";
import { requireSecret } from "@/lib/cron-auth";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Postback de afiliado (Awin/Lomadee/etc.). Aceita GET (query) ou POST (JSON):
 *   subid=<userId>.<productId>  order_id=...  amount=469.90  status=approved|confirmed|pending|declined  date=2026-09-12
 * O nome dos parâmetros varia por rede: mapeie na configuração do postback ou ajuste `read()`.
 */
async function read(request: Request) {
  const q = new URL(request.url).searchParams;
  const b = request.method === "POST" ? ((await request.json().catch(() => ({}))) as Record<string, unknown>) : {};
  const g = (...keys: string[]) => keys.map((k) => (b[k] as string | undefined) ?? q.get(k)).find((v) => v != null && v !== "") ?? null;
  return { sub: g("subid", "sub_id", "clickref"), order: g("order_id", "orderid", "transaction_id"), amount: g("amount", "sale_amount", "value"), status: (g("status") ?? "approved").toLowerCase(), date: g("date") };
}

async function handle(request: Request) {
  const denied = requireSecret(request, "AFFILIATE_POSTBACK_SECRET");
  if (denied) return denied;
  const { sub, order, amount, status, date } = await read(request);
  const ids = parseSubId(sub);
  const paid = Number(String(amount).replace(",", "."));
  if (!ids || !order || !Number.isFinite(paid) || paid <= 0) return NextResponse.json({ error: "parâmetros inválidos" }, { status: 400 });

  const db = createAdminClient();
  if (!["approved", "confirmed", "paid"].includes(status)) {
    await db.from("purchases").delete().eq("order_id", order); // pedido cancelado/recusado
    return NextResponse.json({ ok: true, ignored: status });
  }

  const day = (date ?? new Date().toISOString()).slice(0, 10);
  const { data: product } = await db.from("products").select("id, name").eq("id", ids.productId).maybeSingle();
  if (!product) return NextResponse.json({ error: "produto desconhecido" }, { status: 404 });

  // média de 6 meses no dia da compra
  const from = new Date(Date.parse(day) - 180 * 86_400_000).toISOString().slice(0, 10);
  const { data: hist } = await db.from("price_history").select("min_price").eq("product_id", product.id).gte("date", from).lte("date", day);
  const prices = (hist ?? []).map((h) => Number(h.min_price));
  if (!prices.length) return NextResponse.json({ error: "sem histórico para calcular a média" }, { status: 422 });
  const avg = Math.round((prices.reduce((a, b) => a + b, 0) / prices.length) * 100) / 100;

  const { error } = await db.from("purchases").upsert(
    { user_id: ids.userId, product_id: product.id, name: product.name, paid, avg_at_purchase: avg, date: day, order_id: order },
    { onConflict: "order_id" },
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export const GET = handle;
export const POST = handle;
