-- Link de afiliado separado do produto: troque seu código em 1 lugar e todos os links mudam.
create table public.affiliate_programs (
  store text primary key,                 -- mesmo nome usado em offers.store (ex.: 'Amazon')
  append_params text,                     -- ex.: 'tag=seucodigo-20' (acrescentado ao link do produto)
  link_template text,                     -- alternativa completa, ex.: https://www.awin1.com/cread.php?awinmid=1&awinaffid=2&clickref={subid}&ued={url_encoded}
  updated_at timestamptz not null default now()
);
alter table public.affiliate_programs enable row level security;
create policy "programas: admin" on public.affiliate_programs for all using (public.is_admin()) with check (public.is_admin());

alter table public.offers add column product_url text;           -- endereço "limpo" do produto na loja
alter table public.offers alter column url_affiliate drop not null; -- agora é só um override manual opcional
