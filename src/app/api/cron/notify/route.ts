import { NextResponse } from "next/server";
import { requireSecret } from "@/lib/cron-auth";
import { runNotifications } from "@/lib/notify/run";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const denied = requireSecret(request, "CRON_SECRET");
  if (denied) return denied;
  return NextResponse.json(await runNotifications());
}
