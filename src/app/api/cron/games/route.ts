import { NextResponse } from "next/server";
import { requireSecret } from "@/lib/cron-auth";
import { importEnebaFeed } from "@/lib/eneba";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const denied = requireSecret(request, "CRON_SECRET");
  if (denied) return denied;
  try {
    return NextResponse.json(await importEnebaFeed());
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
