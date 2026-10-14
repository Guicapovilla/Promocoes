import { NextResponse } from "next/server";
import { requireSecret } from "@/lib/cron-auth";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Webhook genérico de apoiadores (Apoia.se / Catarse / YouTube Members / Stripe via automação).
 * POST { "email": "a@b.com", "active": true, "since": "2026-03-01" }  — header `x-webhook-secret` ou `Authorization: Bearer`.
 * Adapte o corpo da plataforma escolhida para este formato (Zapier/Make/Edge Function) ou ajuste o parse abaixo.
 */
export async function POST(request: Request) {
  const denied = requireSecret(request, "SUPPORTER_WEBHOOK_SECRET");
  if (denied) return denied;
  const body = (await request.json().catch(() => null)) as { email?: string; active?: boolean; since?: string } | null;
  const email = body?.email?.trim().toLowerCase();
  if (!email || !email.includes("@")) return NextResponse.json({ error: "email inválido" }, { status: 400 });
  const active = body?.active ?? true;
  const since = body?.since ?? new Date().toISOString().slice(0, 10);

  const db = createAdminClient();
  const { error } = await db.from("supporters").upsert({ email, active, since, updated_at: new Date().toISOString() });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  // se a conta já existe, atualiza o perfil na hora
  await db.from("profiles").update({ is_supporter: active, ...(active ? { supporter_since: since } : {}) }).eq("email", email);
  return NextResponse.json({ ok: true });
}
