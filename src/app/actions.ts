"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { parseBR } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { Channels, TriggerKind } from "@/lib/types";

async function authed() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Não autenticado");
  return { supabase, user: data.user };
}

const refresh = () => revalidatePath("/", "layout");

export async function setRadar(productId: string, on: boolean) {
  const { supabase, user } = await authed();
  if (on) {
    const { error } = await supabase.from("radar").upsert({ user_id: user.id, product_id: productId }, { ignoreDuplicates: true });
    if (error) throw error;
  } else {
    const { error } = await supabase.from("radar").delete().eq("user_id", user.id).eq("product_id", productId);
    if (error) throw error;
  }
  refresh();
}

/** `raw` vazio/null volta ao alvo automático. */
export async function setRadarTarget(productId: string, raw: string | null) {
  const { supabase, user } = await authed();
  const value = raw == null || raw.trim() === "" ? null : parseBR(raw);
  const { error } = await supabase.from("radar").update({ target_price: value }).eq("user_id", user.id).eq("product_id", productId);
  if (error) throw error;
  refresh();
}

export async function setRadarNotify(productId: string, notify: boolean) {
  const { supabase, user } = await authed();
  const { error } = await supabase.from("radar").update({ notify }).eq("user_id", user.id).eq("product_id", productId);
  if (error) throw error;
  refresh();
}

export async function saveSettings(channels: Channels, trigger: TriggerKind) {
  const { supabase, user } = await authed();
  const { error } = await supabase.from("profiles").update({ channels, trigger }).eq("user_id", user.id);
  if (error) throw error;
  refresh();
}

export async function sendSuggestion(type: string, text: string) {
  const { supabase, user } = await authed();
  const { error } = await supabase.from("suggestions").insert({ user_id: user.id, type, text: text.trim() });
  if (error) throw error;
}

export async function savePushSubscription(sub: { endpoint: string; keys: { p256dh: string; auth: string } }) {
  const { supabase, user } = await authed();
  const { error } = await supabase
    .from("push_subscriptions")
    .upsert({ user_id: user.id, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth }, { onConflict: "endpoint" });
  if (error) throw error;
}

export async function markNotificationRead(id: string) {
  const { supabase, user } = await authed();
  await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id).eq("user_id", user.id);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
