import { NextResponse } from "next/server";
import { requireSecret } from "@/lib/cron-auth";
import { ingestPrices } from "@/lib/ingest";
import { runNotifications } from "@/lib/notify/run";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const denied = requireSecret(request, "CRON_SECRET");
  if (denied) return denied;
  const ingest = await ingestPrices();
  const notify = await runNotifications();
  return NextResponse.json({ ingest, notify });
}
