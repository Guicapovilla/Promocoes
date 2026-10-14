"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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
