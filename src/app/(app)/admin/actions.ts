"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { detectStore } from "@/lib/stores";
import { getProfile } from "@/lib/data";
import { createAdminClient } from "@/lib/supabase/admin";

export async function saveService(formData: FormData) {
  const supabase = await createClient(); // RLS: só is_admin() escreve
  const f = (k: string) => String(formData.get(k) ?? "").trim();
  const row = {
    category: f("category"), store: f("store"), city: f("city"), title: f("title"), description: f("description"),
    price_from: Number(f("price_from").replace(",", ".")), perk: f("perk") || null,
    contact_url: f("contact_url"), details_url: f("details_url") || null, logo_url: f("logo_url") || null,
  };
  const id = f("id");
  const { error } = id ? await supabase.from("services").update(row).eq("id", id) : await supabase.from("services").insert(row);
  if (error) throw new Error(error.message);
  revalidatePath("/servicos");
  revalidatePath("/admin/servicos");
}

export async function deleteService(formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.from("services").delete().eq("id", String(formData.get("id")));
  if (error) throw new Error(error.message);
  revalidatePath("/servicos");
  revalidatePath("/admin/servicos");
}

// ───────── Produtos, ofertas e links de afiliado ─────────

async function requireAdmin() {
  const p = await getProfile();
  if (!p?.is_admin) throw new Error("Apenas administradores");
  return createAdminClient();
}

const slugify = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export async function saveProgram(formData: FormData) {
  const db = await requireAdmin();
  const store = String(formData.get("store"));
  const { error } = await db.from("affiliate_programs").upsert({
    store,
    append_params: String(formData.get("append_params") ?? "").trim() || null,
    link_template: String(formData.get("link_template") ?? "").trim() || null,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/ofertas");
}

/** Cola o endereço da loja → reconhece a loja, cria/atualiza a oferta e registra o preço de hoje. */
export async function addOffer(formData: FormData) {
  const db = await requireAdmin();
  const url = String(formData.get("url") ?? "");
  const match = detectStore(url);
  if (!match) redirect("/admin/ofertas?erro=url");
  const price = Number(String(formData.get("price") ?? "").replace(/\./g, "").replace(",", "."));
  if (!Number.isFinite(price) || price <= 0) redirect("/admin/ofertas?erro=preco");

  let productId = String(formData.get("product_id") ?? "");
  if (!productId) {
    const name = String(formData.get("new_name") ?? "").trim();
    if (!name) redirect("/admin/ofertas?erro=produto");
    const { data, error } = await db.from("products")
      .insert({ slug: slugify(name), name, category: String(formData.get("new_category") ?? "").trim() || "Outros" })
      .select("id").single();
    if (error) throw new Error(error.message);
    productId = data.id;
  }
  const { error } = await db.from("offers").upsert(
    { product_id: productId, store: match.store, price, product_url: match.canonicalUrl, external_id: match.externalId, source: match.store === "Mercado Livre" && match.externalId && process.env.ML_CLIENT_ID ? "mercadolivre" : "manual", url_affiliate: null, fetched_at: new Date().toISOString() },
    { onConflict: "product_id,store" },
  );
  if (error) throw new Error(error.message);
  await db.rpc("record_daily_min");
  revalidatePath("/", "layout");
  redirect("/admin/ofertas?ok=1");
}

export async function updateOfferPrice(formData: FormData) {
  const db = await requireAdmin();
  const price = Number(String(formData.get("price") ?? "").replace(/\./g, "").replace(",", "."));
  if (!Number.isFinite(price) || price <= 0) return;
  await db.from("offers").update({ price, fetched_at: new Date().toISOString() }).eq("id", String(formData.get("id")));
  await db.rpc("record_daily_min");
  revalidatePath("/", "layout");
}

export async function deleteOffer(formData: FormData) {
  const db = await requireAdmin();
  await db.from("offers").delete().eq("id", String(formData.get("id")));
  revalidatePath("/", "layout");
}
