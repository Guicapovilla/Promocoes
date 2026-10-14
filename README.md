# Central de Promoções · Capovilla

Next.js 15 (App Router, TypeScript) + Supabase (Auth, Postgres, Realtime). Recria o handoff de design
`design_handoff_central_promocoes` (alta fidelidade) seguindo a ordem de implementação sugerida.

## Rodando localmente

```bash
cp .env.example .env.local        # preencha as chaves do Supabase
npm install
npm run dev                       # http://localhost:3000
npm test                          # regras de negócio (src/lib/pricing.ts)
npm run typecheck
```

### Banco (Supabase)

1. Crie um projeto em supabase.com (ou use `supabase start`).
2. Rode `supabase/migrations/20260101000000_init.sql` (SQL Editor ou `supabase db push`).
3. **Só em desenvolvimento:** rode `supabase/seed.sql` (produtos, ofertas, 364 dias de histórico, jogos e serviços de demonstração).
4. Em *Authentication → Providers* ative E-mail e (opcional) Google; em *URL Configuration* adicione `<SITE_URL>/auth/callback`.
5. Para virar apoiador sem webhook: `insert into supporters (email) values ('voce@email.com');` **antes** de criar a conta
   (ou `update profiles set is_supporter = true where email = '...'`). Para admin: `update profiles set is_admin = true where email = '...'`.

## Estrutura

| Caminho | O que faz |
|---|---|
| `src/app/(app)/` | Promoções (`/`), Meu radar, Jogos, Serviços, Admin de serviços. O layout aplica o gate de apoiador |
| `src/components/` | Nav, destaque + gráfico, radar, modais (Configurações, Economia), toasts, ajuda/sugestões |
| `src/lib/pricing.ts` | Média, classificação verde/amarelo/vermelho, menor do ano, alvo do radar, previsão, ordenação |
| `src/lib/ingest/` | Coleta de preços: providers `shopee` (Affiliate Open API), `amazon` (Creators API), `feed` (Awin/Lomadee, CSV/JSON; Casas Bahia etc.), `mercadolivre` |
| `src/lib/notify/run.ts` | Avalia o radar → aviso no site (Realtime), Web Push, e-mail (Resend), WhatsApp (Z-API) |
| `src/app/api/cron/*` | `prices` (coleta + avisos), `notify`, `games` (feed Eneba), protegidos por `CRON_SECRET` |
| `src/app/api/webhooks/*` | `supporter` (flag `is_supporter`), `affiliate` (postback → `purchases`) |
| `src/app/go/[offerId]` | Redireciona para a loja com `subid=<user>.<produto>` e registra o clique |
| `supabase/` | Migração (tabelas, RLS, funções) e seed de demonstração |

## Como cada item do handoff foi implementado

- **Acesso**: o middleware exige login; `profiles.is_supporter` decide. Não apoiadores veem o overlay "Exclusivo para apoiadores" e **nenhum dado é enviado**: o RLS só libera as tabelas de conteúdo para apoiadores.
  `is_supporter`/`is_admin` não são editáveis pelo usuário (grant de colunas).
- **Preços**: `offers` (preço atual por loja) + `price_history` (1 linha/dia, menor preço). `record_daily_min()` fecha o dia a cada coleta.
- **Regras**: média por período (padrão 6m), `pct = round((agora/média − 1)·100)`, verde ≤ −5, amarelo ≤ 3, vermelho > 3, alvo automático = média 6m × 0,95, parsing de "R$ 3.500" etc. (testado).
- **Último vídeo**: YouTube Data API via playlist de uploads (1 unidade de cota), cache de 1h. Sem chave, o banner some.
- **Visto por último**: `localStorage`, com o preço no momento da visualização.
- **Economia**: soma de `avg_at_purchase − paid` das compras registradas pelo postback do afiliado (idempotente por `order_id`).

## Descoberta automática e busca

Além de atualizar o preço das ofertas cadastradas, o sistema **encontra produtos sozinho**:

- `watchlist` (tabela, editável no Supabase) define o que monitorar: termo, apelidos, faixa de preço e palavras que eliminam o anúncio (acessórios). A migração `20260201000000_discovery.sql` já traz uma lista inicial de videogames (Switch, PS5, Xbox, Steam Deck, ROG Ally, Quest, controles).
- `/api/cron/discover` (06:15 e 18:15 UTC) busca cada termo na Shopee e na Amazon, lê o catálogo dos feeds (`PRICE_FEED_<LOJA>_URL`), filtra pelas regras e grava produto + oferta com o link de afiliado. Depois fecha o dia (`price_history` e `offer_prices`) e remove ofertas automáticas sem preço novo há 7 dias.
- O mesmo anúncio em lojas diferentes vira um produto só quando o título normalizado coincide (`products.match_key`) ou o EAN do feed bate.
- **Busca do dashboard** (`/api/search`): ao digitar (3+ letras), consulta Shopee/Amazon na hora (cache de 30 min por termo, teto `LIVE_SEARCH_PER_HOUR`), grava o que achou como produto monitorado e responde com o catálogo. Tudo que aparece numa busca passa a ter histórico a partir daquele dia.
- A home carrega os 300 produtos mais populares (mais o produto pedido e os do seu radar); a busca alcança o resto.

Limites: não existe histórico retroativo (o histórico de cada produto começa quando ele entra no sistema); o link da Shopee carrega o seu ID, mas a atribuição por usuário (`subid`) não é repassada pela Shopee; o casamento entre lojas por título é aproximado.

## Produção (Vercel)

1. Importe o repositório e configure as variáveis do `.env.example`.
2. `vercel.json` agenda `/api/cron/prices` (09/13/17/21 UTC, 4×/dia, e dispara os avisos) e `/api/cron/games`. O Vercel envia `Authorization: Bearer $CRON_SECRET`.
3. **Web Push**: `npx web-push generate-vapid-keys` → `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`.
4. **Apoiadores**: faça a plataforma (Apoia.se, Catarse, Stripe, YouTube Members via Zapier/Make) chamar
   `POST /api/webhooks/supporter` com `x-webhook-secret` e `{"email","active","since"}`.
5. **Postback de afiliado**: aponte para `/api/webhooks/affiliate?secret=...&subid={subid}&order_id={order}&amount={amount}&status={status}`
   (mapeie os nomes conforme a rede). Os links de loja precisam do placeholder `{subid}` em `offers.url_affiliate`.

## Limites e premissas (leia antes de ir ao ar)

- **Não foi testado contra um Supabase real nem com APIs externas.** Validado: build, typecheck, testes unitários, migração + seed + RLS em um Postgres 16 local (com stub do schema `auth`) e a página de login no navegador. As telas logadas não foram vistas rodando; revise visualmente.
- **Shopee e Amazon (Creators API)** foram implementados a partir da documentação, mas **não foram testados contra as APIs reais** (só assinatura/parsing em testes unitários). A Amazon exige conta Associates com vendas qualificadas e credenciais Creators API; a PA-API 5.0 foi descontinuada.
- **Como cadastrar ofertas**: em `offers`, use `source = 'shopee'` (`external_id` = itemId), `source = 'amazon'` (`external_id` = ASIN) ou `source = 'feed'` com `store = 'Casas Bahia'` (`external_id` = SKU do feed, variável `PRICE_FEED_CASASBAHIA_URL`). Mercado Livre e feeds dependem de `offers.source`/`external_id` preenchidos.
- **Feed da Eneba**: o parser aceita nomes de coluna comuns, mas o layout real depende do programa; ajuste `src/lib/eneba.ts`.
- **Apoia.se/Catarse/etc.**: cada plataforma tem seu formato de webhook; o endpoint aceita um formato genérico.
- Datas em `events` e quedas em `event_drops` são cadastradas à mão (Table Editor). Fotos/capas/logos vêm de `image_url`/`cover_url`/`logo_url`; sem elas aparece o placeholder listrado do design.
- Estilos em CSS puro com os tokens do design system (`src/styles/`), em vez de Tailwind.
- WhatsApp (Z-API) e e-mail (Resend) são opcionais e só rodam com as variáveis configuradas; o número do WhatsApp precisa ser gravado em `profiles.whatsapp`.
