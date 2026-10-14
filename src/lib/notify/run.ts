import webpush from "web-push";
import { fmt } from "../format";
import { autoTarget, isYearLow, stats, type PricePoint } from "../pricing";
import { createAdminClient } from "../supabase/admin";
import type { Channels, TriggerKind } from "../types";

type Alert = { userId: string; productId: string; slug: string; title: string; body: string; price: number };

const MIN_GAP_MS = 20 * 3600_000; // no máximo um aviso por produto a cada ~20h

/** Avalia o radar de todos os usuários e dispara avisos (site, push, e-mail, WhatsApp) conforme as preferências. */
export async function runNotifications() {
  const db = createAdminClient();
  const since = new Date(Date.now() - 365 * 86_400_000).toLocaleDateString("sv-SE");
  const [radar, prods, offers, hist, profiles] = await Promise.all([
    db.from("radar").select("*").eq("notify", true),
    db.from("products").select("id, slug, name").eq("active", true),
    db.from("offers").select("product_id, store, price"),
    db.from("price_history").select("product_id, date, min_price").gte("date", since).order("date").limit(50000),
    db.from("profiles").select("user_id, email, whatsapp, channels, trigger").eq("is_supporter", true),
  ]);

  const series = new Map<string, PricePoint[]>();
  for (const h of hist.data ?? []) series.set(h.product_id, [...(series.get(h.product_id) ?? []), { date: h.date, price: Number(h.min_price) }]);
  const best = new Map<string, { price: number; store: string }>();
  for (const o of offers.data ?? []) {
    const cur = best.get(o.product_id);
    if (!cur || Number(o.price) < cur.price) best.set(o.product_id, { price: Number(o.price), store: o.store });
  }
  const product = new Map((prods.data ?? []).map((p) => [p.id, p]));
  const profile = new Map((profiles.data ?? []).map((p) => [p.user_id, p]));

  const alerts: Alert[] = [];
  for (const r of radar.data ?? []) {
    const prof = profile.get(r.user_id);
    const prod = product.get(r.product_id);
    const s = series.get(r.product_id);
    const now = best.get(r.product_id);
    if (!prof || !prod || !s?.length || !now) continue;
    if (r.last_notified_at && Date.now() - Date.parse(r.last_notified_at) < MIN_GAP_MS) continue;

    const cur = [...s.slice(0, -1), { date: "hoje", price: now.price }];
    const st = stats(cur, 180);
    const trigger = prof.trigger as TriggerKind;
    const target = r.target_price != null ? Number(r.target_price) : autoTarget(st.avg);
    const prev = r.last_notified_price != null ? Number(r.last_notified_price) : null;
    const yesterday = s.length > 1 ? s[s.length - 2].price : now.price;

    let hit = false;
    let why = "";
    if (trigger === "alvo") { hit = now.price <= target && (prev == null || now.price < prev); why = `abaixo do seu alvo de ${fmt(target)}`; }
    else if (trigger === "minimo") { hit = isYearLow(cur) && (prev == null || now.price < prev); why = "menor preço do ano"; }
    else { hit = now.price < yesterday && (prev == null || now.price < prev); why = `caiu ${fmt(yesterday - now.price)} desde ontem`; }
    if (!hit) continue;

    alerts.push({
      userId: r.user_id, productId: r.product_id, slug: prod.slug, price: now.price,
      title: `${prod.name} ${trigger === "alvo" ? "entrou no alvo" : trigger === "minimo" ? "está no menor preço do ano" : "ficou mais barato"}`,
      body: `${fmt(now.price)} na ${now.store} · ${why}`,
    });
  }

  const vapidOk = !!(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
  if (vapidOk) webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:admin@example.com", process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);

  const stats2 = { alerts: alerts.length, site: 0, push: 0, email: 0, whatsapp: 0, errors: [] as string[] };
  for (const a of alerts) {
    const prof = profile.get(a.userId)!;
    const ch = prof.channels as Channels;
    const url = `/?p=${a.slug}`;
    try {
      if (ch.site) {
        await db.from("notifications").insert({ user_id: a.userId, title: a.title, body: a.body, product_id: a.productId });
        stats2.site++;
      }
      if (ch.push && vapidOk) {
        const { data: subs } = await db.from("push_subscriptions").select("id, endpoint, p256dh, auth").eq("user_id", a.userId);
        for (const sub of subs ?? []) {
          try {
            await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify({ title: a.title, body: a.body, url }));
            stats2.push++;
          } catch (e) {
            const code = (e as { statusCode?: number }).statusCode;
            if (code === 404 || code === 410) await db.from("push_subscriptions").delete().eq("id", sub.id); // inscrição expirada
            else stats2.errors.push(`push: ${String(e)}`);
          }
        }
      }
      if (ch.email && prof.email && process.env.RESEND_API_KEY) {
        const site = process.env.NEXT_PUBLIC_SITE_URL ?? "";
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({ from: process.env.RESEND_FROM, to: prof.email, subject: a.title, text: `${a.body}\n\n${site}${url}` }),
        });
        if (res.ok) stats2.email++; else stats2.errors.push(`email: ${res.status}`);
      }
      if (ch.wpp && prof.whatsapp && process.env.ZAPI_INSTANCE_URL) {
        const res = await fetch(`${process.env.ZAPI_INSTANCE_URL}/send-text`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Client-Token": process.env.ZAPI_CLIENT_TOKEN ?? "" },
          body: JSON.stringify({ phone: prof.whatsapp, message: `${a.title}\n${a.body}` }),
        });
        if (res.ok) stats2.whatsapp++; else stats2.errors.push(`whatsapp: ${res.status}`);
      }
      await db.from("radar").update({ last_notified_price: a.price, last_notified_at: new Date().toISOString() }).eq("user_id", a.userId).eq("product_id", a.productId);
    } catch (e) {
      stats2.errors.push(String(e));
    }
  }
  return stats2;
}
