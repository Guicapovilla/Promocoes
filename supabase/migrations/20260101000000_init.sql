-- Central de Promoções — schema inicial
create extension if not exists pgcrypto;

-- ───────────────────────── Perfis e apoiadores ─────────────────────────
create table public.supporters (
  email text primary key,                       -- sempre em minúsculas
  active boolean not null default true,
  since date,
  updated_at timestamptz not null default now()
);

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text,
  name text,
  avatar_url text,
  is_supporter boolean not null default false,
  is_admin boolean not null default false,
  supporter_since date,
  channels jsonb not null default '{"site": true, "push": true, "email": false, "wpp": false}',
  trigger text not null default 'alvo' check (trigger in ('alvo', 'minimo', 'qualquer')),
  whatsapp text,
  created_at timestamptz not null default now()
);

create or replace function public.is_supporter() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_supporter from public.profiles where user_id = auth.uid()), false)
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from public.profiles where user_id = auth.uid()), false)
$$;

-- cria o perfil no cadastro e já aplica o status de apoiador, se o e-mail estiver na tabela
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare s public.supporters;
begin
  select * into s from public.supporters where email = lower(new.email) and active;
  insert into public.profiles (user_id, email, name, avatar_url, is_supporter, supporter_since)
  values (
    new.id, lower(new.email),
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'avatar_url',
    s.email is not null, s.since
  );
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ───────────────────────── Catálogo ─────────────────────────
create table public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  category text not null,
  image_url text,
  rec_note text,
  rec_video_title text,
  rec_video_url text,
  bf_drop_pct int not null default 0,           -- queda média na Black Friday do ano anterior
  popularity int not null default 0,
  likes int not null default 0,
  rating numeric(2, 1) not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.offers (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  store text not null,
  price numeric(10, 2) not null check (price > 0),
  url_affiliate text not null,                  -- aceita o placeholder {subid}
  source text not null default 'manual',        -- manual | feed | mercadolivre | amazon ...
  external_id text,
  fetched_at timestamptz not null default now(),
  unique (product_id, store)
);

create table public.price_history (
  product_id uuid not null references public.products (id) on delete cascade,
  date date not null,
  min_price numeric(10, 2) not null,
  primary key (product_id, date)
);

-- grava (ou atualiza) o menor preço do dia entre as lojas
create or replace function public.record_daily_min(day date default (now() at time zone 'America/Sao_Paulo')::date)
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  insert into public.price_history (product_id, date, min_price)
  select o.product_id, day, min(o.price)
  from public.offers o join public.products p on p.id = o.product_id and p.active
  group by o.product_id
  on conflict (product_id, date) do update set min_price = excluded.min_price;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.record_daily_min(date) from public, anon, authenticated;

-- ───────────────────────── Jogos, serviços, datas ─────────────────────────
create table public.games (
  id uuid primary key default gen_random_uuid(),
  external_id text unique,
  name text not null,
  platform text not null check (platform in ('Steam', 'PSN', 'Xbox', 'Nintendo', 'Outros')),
  region text not null default 'Brasil',
  cover_url text,
  price numeric(10, 2) not null,
  original_price numeric(10, 2) not null,
  discount_pct int generated always as (
    case when original_price > 0 then greatest(0, round((1 - price / original_price) * 100)::int) else 0 end
  ) stored,
  url_affiliate text not null,
  popularity int not null default 0,
  likes int not null default 0,
  rating numeric(2, 1) not null default 0,
  updated_at timestamptz not null default now()
);

create table public.services (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('Desbloqueio', 'Conserto', 'Manutenção', 'Upgrade')),
  store text not null,
  city text not null,
  title text not null,
  description text not null,
  price_from numeric(10, 2) not null,
  perk text,
  logo_url text,
  contact_url text not null,                    -- ex.: https://wa.me/55119...
  details_url text,
  active boolean not null default true,
  sort int not null default 0
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  date date not null                            -- próxima ocorrência (atualize todo ano)
);

create table public.event_drops (                -- queda do ano anterior, por produto e data
  event_id uuid not null references public.events (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  drop_pct int not null,
  primary key (event_id, product_id)
);

-- ───────────────────────── Dados do usuário ─────────────────────────
create table public.radar (
  user_id uuid not null references auth.users (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  notify boolean not null default true,
  target_price numeric(10, 2),                  -- null = automático (média 6m × 0,95)
  last_notified_price numeric(10, 2),
  last_notified_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

create table public.purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  name text not null,
  paid numeric(10, 2) not null,
  avg_at_purchase numeric(10, 2) not null,
  date date not null,
  order_id text unique,                          -- idempotência do postback
  created_at timestamptz not null default now()
);

create table public.suggestions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null check (type in ('Melhoria', 'Problema', 'Novo produto')),
  text text not null check (char_length(text) between 3 and 2000),
  created_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null default 'radar',
  title text not null,
  body text not null,
  product_id uuid references public.products (id) on delete cascade,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

create table public.link_clicks (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users (id) on delete set null,
  offer_id uuid references public.offers (id) on delete set null,
  created_at timestamptz not null default now()
);

-- ───────────────────────── RLS ─────────────────────────
alter table public.supporters enable row level security;           -- sem policies: só service role
alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.offers enable row level security;
alter table public.price_history enable row level security;
alter table public.games enable row level security;
alter table public.services enable row level security;
alter table public.events enable row level security;
alter table public.event_drops enable row level security;
alter table public.radar enable row level security;
alter table public.purchases enable row level security;
alter table public.suggestions enable row level security;
alter table public.notifications enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.link_clicks enable row level security;           -- sem policies: só service role

create policy "perfil: leitura própria" on public.profiles for select using (user_id = auth.uid());
create policy "perfil: edição própria" on public.profiles for update using (user_id = auth.uid());
-- o usuário só pode editar estes campos; is_supporter / is_admin são controlados pelo servidor
revoke update on public.profiles from authenticated, anon;
grant update (name, avatar_url, channels, trigger, whatsapp) on public.profiles to authenticated;

-- conteúdo: somente apoiadores leem; admins escrevem
do $$
declare t text;
begin
  foreach t in array array['products', 'offers', 'price_history', 'games', 'services', 'events', 'event_drops'] loop
    execute format('create policy "%1$s: apoiadores leem" on public.%1$s for select using (public.is_supporter() or public.is_admin())', t);
    execute format('create policy "%1$s: admin escreve" on public.%1$s for all using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;

create policy "radar: próprio" on public.radar for all
  using (user_id = auth.uid() and public.is_supporter())
  with check (user_id = auth.uid() and public.is_supporter());
create policy "compras: leitura própria" on public.purchases for select using (user_id = auth.uid());
create policy "sugestões: envio próprio" on public.suggestions for insert with check (user_id = auth.uid());
create policy "avisos: leitura própria" on public.notifications for select using (user_id = auth.uid());
create policy "avisos: marcar como lido" on public.notifications for update using (user_id = auth.uid());
create policy "push: próprio" on public.push_subscriptions for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- avisos em tempo real no site
alter publication supabase_realtime add table public.notifications;
