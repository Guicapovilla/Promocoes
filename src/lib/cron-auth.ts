import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

const safeEq = (a: string, b: string) => {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

/** Vercel Cron envia `Authorization: Bearer $CRON_SECRET`. Retorna uma resposta de erro ou null se autorizado. */
export function requireSecret(request: Request, envName: "CRON_SECRET" | "SUPPORTER_WEBHOOK_SECRET" | "AFFILIATE_POSTBACK_SECRET") {
  const secret = process.env[envName];
  if (!secret) return NextResponse.json({ error: `${envName} não configurado` }, { status: 503 });
  const url = new URL(request.url);
  const given = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? request.headers.get("x-webhook-secret") ?? url.searchParams.get("secret") ?? "";
  return safeEq(given, secret) ? null : NextResponse.json({ error: "não autorizado" }, { status: 401 });
}
