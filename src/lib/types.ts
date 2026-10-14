import type { PricePoint } from "./pricing";

export type Channels = { site: boolean; push: boolean; email: boolean; wpp: boolean };
export type TriggerKind = "alvo" | "minimo" | "qualquer";

export type Profile = {
  user_id: string;
  email: string | null;
  name: string | null;
  avatar_url: string | null;
  is_supporter: boolean;
  is_admin: boolean;
  supporter_since: string | null;
  channels: Channels;
  trigger: TriggerKind;
  whatsapp: string | null;
};

export type Offer = { id: string; store: string; price: number; fetched_at: string };

export type Product = {
  id: string;
  slug: string;
  name: string;
  category: string;
  image_url: string | null;
  rec_note: string | null;
  rec_video_title: string | null;
  rec_video_url: string | null;
  bf_drop_pct: number;
  popularity: number;
  likes: number;
  rating: number;
  offers: Offer[]; // ordenadas por preço
  series: PricePoint[]; // últimos 365 dias; o último ponto é o preço de hoje
  price: number; // menor preço agora
  store: string; // loja do menor preço
  offerId: string;
};

export type RadarItem = { product_id: string; notify: boolean; target_price: number | null };
export type Purchase = { id: string; name: string; paid: number; avg_at_purchase: number; date: string };

export type Game = {
  id: string;
  name: string;
  platform: string;
  region: string;
  cover_url: string | null;
  price: number;
  original_price: number;
  discount_pct: number;
  url_affiliate: string;
  popularity: number;
  likes: number;
  rating: number;
};

export type Service = {
  id: string;
  category: string;
  store: string;
  city: string;
  title: string;
  description: string;
  price_from: number;
  perk: string | null;
  logo_url: string | null;
  contact_url: string;
  details_url: string | null;
};

export type PromoEvent = { id: string; name: string; date: string; days: number; items: { name: string; drop: number }[] };

export type AppNotification = { id: string; title: string; body: string; product_id: string | null; created_at: string };
