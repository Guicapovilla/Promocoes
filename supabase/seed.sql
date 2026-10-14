-- Dados de DEMONSTRAÇÃO (desenvolvimento). Não rode em produção.
insert into public.products (slug, name, category, rec_note, rec_video_title, rec_video_url, bf_drop_pct, popularity, likes, rating) values
  ('sw2',  'Nintendo Switch 2',           'Console · Nintendo',   'Uso todo dia. Hoje é o console com melhor custo-benefício da Nintendo.', 'Switch desbloqueado: vale a pena em 2026?', 'https://youtube.com', 12, 4200, 812, 4.8),
  ('oled', 'Nintendo Switch OLED',        'Console · Nintendo',   null, null, null, 18, 3100, 540, 4.6),
  ('deck', 'Steam Deck OLED 512GB',       'Portátil · Valve',     'Melhor portátil para PC se a biblioteca já é na Steam.', 'Steam Deck OLED: 1 ano de uso', 'https://youtube.com', 10, 3800, 705, 4.7),
  ('ps5',  'PlayStation 5 Slim Digital',  'Console · Sony',       null, null, null, 22, 4900, 930, 4.7),
  ('xss',  'Xbox Series S 512GB',         'Console · Microsoft',  null, null, null, 15, 2200, 380, 4.3),
  ('ally', 'ROG Ally X',                  'Portátil · ASUS',      null, null, null,  8, 1500, 260, 4.2),
  ('pro',  'Controle Pro Switch 2',       'Acessório · Nintendo', 'O único controle que eu indico sem ressalva.', 'Os melhores acessórios do Switch 2', 'https://youtube.com', 20, 2600, 610, 4.9),
  ('rg',   'Anbernic RG35XX Plus',        'Retrô · Anbernic',     'Para quem quer só emulação, não precisa de mais que isso.', 'O melhor portátil retrô barato', 'https://youtube.com', 14, 1200, 330, 4.4);

-- ofertas: [slug, loja, preço]; a primeira de cada produto é a mais barata
insert into public.offers (product_id, store, price, url_affiliate)
select p.id, v.store, v.price, 'https://exemplo.com/' || p.slug || '?aff=capovilla&sub={subid}'
from (values
  ('sw2','Amazon',3799.90),('sw2','Mercado Livre',3913.90),('sw2','KaBuM!',4008.90),('sw2','Magalu',4103.90),
  ('oled','KaBuM!',2449.00),('oled','Amazon',2522.47),('oled','Magalu',2583.70),
  ('deck','Mercado Livre',4999.00),('deck','Amazon',5148.97),('deck','KaBuM!',5273.94),
  ('ps5','Magalu',3149.10),('ps5','Amazon',3243.57),('ps5','Casas Bahia',3322.30),('ps5','Mercado Livre',3401.03),
  ('xss','Casas Bahia',2589.00),('xss','Amazon',2666.67),('xss','Magalu',2731.40),
  ('ally','Amazon',6899.00),('ally','KaBuM!',7105.97),
  ('pro','Amazon',469.90),('pro','Mercado Livre',484.00),('pro','KaBuM!',495.75),
  ('rg','AliExpress',612.00),('rg','Mercado Livre',630.36)
) as v(slug, store, price) join public.products p on p.slug = v.slug;

-- 364 dias de histórico (passeio determinístico em torno de um preço-base)
insert into public.price_history (product_id, date, min_price)
select p.id, current_date - g.i,
  greatest(b.floor, round((b.base * (1 + 0.07 * sin(g.i / 31.0 + b.ph) + 0.035 * sin(g.i / 9.0 + b.ph * 2)))::numeric, 2))
from public.products p
join (values
  ('sw2',4299,4099,1.0),('oled',2399,0,2.0),('deck',4599,0,3.0),('ps5',3499,0,4.0),
  ('xss',2599,0,5.0),('ally',6299,0,6.0),('pro',549,489,7.0),('rg',649,0,8.0)
) as b(slug, base, floor, ph) on b.slug = p.slug
cross join generate_series(1, 364) as g(i);

select public.record_daily_min(current_date);

insert into public.events (name, date) values
  ('Black Friday', make_date(extract(year from current_date)::int + case when current_date > make_date(extract(year from current_date)::int, 11, 27) then 1 else 0 end, 11, 27)),
  ('Cyber Monday', make_date(extract(year from current_date)::int + case when current_date > make_date(extract(year from current_date)::int, 11, 30) then 1 else 0 end, 11, 30)),
  ('Fim de ano na eShop', make_date(extract(year from current_date)::int + case when current_date > make_date(extract(year from current_date)::int, 12, 17) then 1 else 0 end, 12, 17)),
  ('Steam Winter Sale', make_date(extract(year from current_date)::int + case when current_date > make_date(extract(year from current_date)::int, 12, 18) then 1 else 0 end, 12, 18));

insert into public.event_drops (event_id, product_id, drop_pct)
select e.id, p.id, greatest(3, round(p.bf_drop_pct * k.k)::int)
from public.events e
join (values ('Black Friday',1.0),('Cyber Monday',0.7),('Fim de ano na eShop',0.6),('Steam Winter Sale',0.5)) as k(name, k) on k.name = e.name
join (select *, row_number() over (order by bf_drop_pct desc) rn from public.products) p on p.rn <= 3;

insert into public.games (external_id, name, platform, price, original_price, url_affiliate, popularity, likes, rating)
select 'demo-' || row_number() over (), n, pf, round((orig * (1 - off / 100.0))::numeric, 2), orig, 'https://www.eneba.com/?af_id=capovilla', pop, lk, rt
from (values
  ('Elden Ring','Steam',62,249.9,4800,820,4.9),('Hollow Knight: Silksong','Steam',25,79.9,4500,900,4.9),('Cyberpunk 2077','Xbox',70,199.9,3000,500,4.4),
  ('Hades II','Steam',20,109.9,2500,610,4.8),('Red Dead Redemption 2','PSN',75,299.9,4100,760,4.9),('Baldur''s Gate 3','Steam',35,199.9,4700,880,4.9),
  ('Mario Kart World','Nintendo',18,449.0,3900,700,4.6),('Forza Horizon 5','Xbox',67,249.0,2900,420,4.6),('Stardew Valley','Nintendo',40,44.9,3300,640,4.8),
  ('God of War Ragnarök','PSN',55,249.9,3600,690,4.8),('Zelda: Tears of the Kingdom','Nintendo',22,349.0,4400,850,4.9),('Hogwarts Legacy','Steam',80,249.9,3200,480,4.3)
) as t(n, pf, off, orig, pop, lk, rt);

insert into public.services (category, store, city, title, description, price_from, perk, contact_url, sort) values
  ('Desbloqueio','Loja parceira A','São Paulo · SP · envio para todo o Brasil','Desbloqueio de Nintendo Switch','Instalação com garantia, backup do console e suporte pós-serviço.',349,'10% off apoiador','https://wa.me/5511900000000',1),
  ('Conserto','Assistência parceira B','Campinas · SP · coleta por correio','Troca de Joy-Con drift e analógicos','Peças Hall Effect, que não sofrem drift. Prazo médio de 5 dias úteis.',189,'Frete grátis','https://wa.me/5519900000000',2),
  ('Conserto','Assistência parceira C','Rio de Janeiro · RJ','Reparo de placa e HDMI de PS5 e Xbox','Diagnóstico gratuito antes de qualquer orçamento.',290,'Diagnóstico grátis','https://wa.me/5521900000000',3),
  ('Manutenção','Loja parceira D','Belo Horizonte · MG · envio para todo o Brasil','Limpeza interna e troca de pasta térmica','Indicado para consoles barulhentos ou esquentando. PS4, PS5, Xbox e Steam Deck.',149,'15% off apoiador','https://wa.me/5531900000000',4),
  ('Upgrade','Loja parceira E','Curitiba · PR · envio para todo o Brasil','Upgrade de SSD no Steam Deck e ROG Ally','Clonagem do sistema incluída. SSD de 1 TB ou 2 TB.',220,'Clonagem grátis','https://wa.me/5541900000000',5),
  ('Desbloqueio','Loja parceira F','Porto Alegre · RS','Desbloqueio de portáteis retrô e emulação','Configuração completa de emuladores e organização da biblioteca.',120,'10% off apoiador','https://wa.me/5551900000000',6);
