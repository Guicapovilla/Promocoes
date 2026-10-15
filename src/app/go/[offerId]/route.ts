import { NextResponse, type NextRequest } from "next/server";
import { resolveAffiliateUrl } from "@/lib/affiliate";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/** Redireciona para a loja com o link de afiliado correto e registra o clique (mesmo desenho do /api/redirect de sites como o Bilômetro). */
export async function GET(request: NextRequest, { params }: { params: Promise<{ offerId: string }> }) {
  const { offerId } = await params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.redirect(new URL("/login", request.url));

  const { data: offer } = await supabase
    .from("offers").select("id, store, product_id, url_affiliate, product_url, external_id").eq("id", offerId).single();
  if (!offer) return NextResponse.redirect(new URL("/", request.url));

  const admin = createAdminClient(); // a tabela de programas é restrita ao admin
  const { data: program } = await admin.from("affiliate_programs").select("append_params, link_template").eq("store", offer.store).maybeSingle();
  const url = resolveAffiliateUrl(offer, program, auth.user.id, offer.product_id);
  if (!url) return NextResponse.redirect(new URL("/", request.url));

  void admin.from("link_clicks").insert({ user_id: auth.user.id, offer_id: offer.id });
  return NextResponse.redirect(url);
}
