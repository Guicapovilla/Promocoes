import { NextResponse, type NextRequest } from "next/server";
import { buildAffiliateUrl } from "@/lib/affiliate";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/** Redireciona para a loja com o subid do usuário (rastreia a compra via postback) e registra o clique. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ offerId: string }> }) {
  const { offerId } = await params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.redirect(new URL("/login", request.url));

  const { data: offer } = await supabase.from("offers").select("id, product_id, url_affiliate").eq("id", offerId).single();
  if (!offer) return NextResponse.redirect(new URL("/", request.url));

  void createAdminClient().from("link_clicks").insert({ user_id: auth.user.id, offer_id: offer.id });
  return NextResponse.redirect(buildAffiliateUrl(offer.url_affiliate, auth.user.id, offer.product_id));
}
