-- Descoberta automática de produtos, histórico por loja e cache de busca
create extension if not exists pg_trgm;

-- ───────────────────────── Produtos descobertos automaticamente ─────────────────────────
alter table public.products
  add column if not exists ean text,
  add column if not exists match_key text,                 -- título normalizado: junta anúncios de lojas diferentes
  add column if not exists auto boolean not null default false;  -- true = criado pela descoberta/busca

create index if not exists products_match_key_idx on public.products (match_key) where match_key is not null;
create index if not exists products_ean_idx on public.products (ean) where ean is not null;
create index if not exists products_name_trgm_idx on public.products using gin (name gin_trgm_ops);

-- ───────────────────────── Histórico de preço por loja ─────────────────────────
create table if not exists public.offer_prices (
  offer_id uuid not null references public.offers (id) on delete cascade,
  date date not null,
  price numeric(10, 2) not null,
  primary key (offer_id, date)
);

-- grava (ou atualiza) o preço do dia de cada oferta
create or replace function public.record_offer_prices(day date default (now() at time zone 'America/Sao_Paulo')::date)
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  insert into public.offer_prices (offer_id, date, price)
  select id, day, price from public.offers
  on conflict (offer_id, date) do update set price = excluded.price;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.record_offer_prices(date) from public, anon, authenticated;

-- ───────────────────────── O que monitorar ─────────────────────────
create table if not exists public.watchlist (
  id uuid primary key default gen_random_uuid(),
  term text not null unique,                    -- termo de busca nas lojas
  aliases text[] not null default '{}',         -- outros nomes aceitos no título (ex.: "ps5")
  category text not null default 'Videogame',
  min_price numeric(10, 2),                     -- descarta anúncios abaixo (acessórios, peças)
  max_price numeric(10, 2),
  exclude text[] not null default '{}',         -- palavras que eliminam o anúncio
  active boolean not null default true,
  last_run_at timestamptz
);

-- cache da busca ao vivo (só service role): evita bater nas APIs a cada digitação
create table if not exists public.search_cache (
  query text primary key,
  fetched_at timestamptz not null default now(),
  hits int not null default 0
);

-- remove ofertas automáticas que sumiram da loja (sem preço novo há N dias) e desativa produtos sem oferta
create or replace function public.prune_stale_offers(days int default 7)
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  delete from public.offers
  where source <> 'manual' and fetched_at < now() - make_interval(days => days)
    and product_id in (select id from public.products where auto);
  get diagnostics n = row_count;
  update public.products p set active = false
  where p.auto and p.active and not exists (select 1 from public.offers o where o.product_id = p.id);
  return n;
end $$;
revoke all on function public.prune_stale_offers(int) from public, anon, authenticated;

-- ───────────────────────── RLS ─────────────────────────
alter table public.offer_prices enable row level security;
alter table public.watchlist enable row level security;
alter table public.search_cache enable row level security;      -- sem policies: só service role

create policy "offer_prices: apoiadores leem" on public.offer_prices for select using (public.is_supporter() or public.is_admin());
create policy "offer_prices: admin escreve" on public.offer_prices for all using (public.is_admin()) with check (public.is_admin());
create policy "watchlist: admin" on public.watchlist for all using (public.is_admin()) with check (public.is_admin());

-- ───────────────────────── Lista inicial: videogames ─────────────────────────
insert into public.watchlist (term, aliases, min_price, max_price, exclude) values
  ('Nintendo Switch OLED',  '{}',                              1500, 5000, '{capa,case,pelicula,película,suporte,skin,adesivo,cabo,carregador,dock,jogo}'),
  ('Nintendo Switch 2',     '{"switch 2"}',                    2500, 9000, '{capa,case,pelicula,película,suporte,skin,adesivo,cabo,carregador,jogo}'),
  ('Nintendo Switch Lite',  '{}',                               900, 4000, '{capa,case,pelicula,película,suporte,skin,adesivo,cabo,carregador,jogo}'),
  ('PlayStation 5 Slim',    '{"ps5 slim"}',                    2500, 9000, '{capa,case,suporte,skin,adesivo,cabo,carregador,base,controle,jogo}'),
  ('Xbox Series X',         '{}',                              2800, 9000, '{capa,case,suporte,skin,adesivo,cabo,carregador,controle,jogo}'),
  ('Xbox Series S',         '{}',                              1800, 6000, '{capa,case,suporte,skin,adesivo,cabo,carregador,controle,jogo}'),
  ('Steam Deck',            '{}',                              2500, 12000,'{capa,case,suporte,skin,adesivo,cabo,carregador,dock,pelicula,película}'),
  ('ASUS ROG Ally',         '{"rog ally"}',                    2500, 12000,'{capa,case,suporte,skin,adesivo,cabo,carregador,dock,pelicula,película}'),
  ('Meta Quest 3',          '{}',                              2500, 9000, '{capa,case,suporte,skin,adesivo,cabo,carregador,strap,lente}'),
  ('Controle DualSense',    '{"dualsense ps5"}',                250,  1200,'{capa,case,suporte,skin,adesivo,cabo,carregador,grip,silicone,base}'),
  ('Nintendo Switch Pro Controller', '{"pro controller"}',     250,  1200,'{capa,case,suporte,skin,adesivo,cabo,carregador,grip,silicone}')
on conflict (term) do nothing;
