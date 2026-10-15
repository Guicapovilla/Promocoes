# Guia passo a passo (para quem não é programador)

Este guia leva você de "projeto no GitHub" até "site no ar, com preços e com os **seus** links de afiliado".
Faça na ordem. Cada parte termina com um teste simples para você saber se deu certo.

## Como o sistema funciona (em 4 linhas)

1. Você cadastra um produto colando o endereço da loja (Amazon, Mercado Livre, Shopee, Casas Bahia, Eneba).
2. O preço de cada dia é guardado no banco de dados. É isso que gera o histórico e as cores verde/amarelo/vermelho.
3. Quando alguém clica em "Ver na loja", o site passa por `/go/...`, coloca **o seu código de afiliado** e manda a pessoa para a loja (é o mesmo truque do Bilômetro).
4. Para trocar de código de afiliado, você muda **um campo** no painel. Nenhum produto precisa ser recadastrado.

## O que é automático e o que é manual (seja realista)

| Loja | Preço automático? | Link de afiliado |
|---|---|---|
| Mercado Livre | **Sim**, pela API oficial (precisa criar um "aplicativo" no site de desenvolvedores) | No painel de afiliados deles |
| Amazon | **Ainda não**: a API deles exige conta aprovada e eu não implementei. Por enquanto: preço digitado | Amazon Associates |
| Shopee | **Ainda não**: preço digitado | Painel de afiliados da Shopee |
| Casas Bahia | **Ainda não**: preço digitado | Pela rede de afiliados em que o programa deles estiver (confirme no painel da rede) |
| Eneba | **Sim**, se o programa de afiliados fornecer o feed (arquivo de ofertas) | Painel de afiliados da Eneba |

"Preço digitado" significa: você atualiza o preço em `/admin/ofertas` (leva 10 segundos por produto). Isso funciona para começar com poucos produtos. Automatizar as outras lojas é um trabalho futuro, feito loja por loja, quando você tiver as contas aprovadas.

> Importante: as regras de cada programa de afiliados mudam e variam por loja (aprovação, comissão, o que é permitido exibir). Eu **não** consegui verificar as regras atuais de todos. Leia os termos de cada programa antes de publicar preços no site.

---

## PARTE 1 · Criar as contas (uma vez só)

### 1.1 Supabase (o banco de dados) · grátis para começar
1. Entre em https://supabase.com e crie uma conta (pode ser com o GitHub).
2. Clique em **New project**. Nome: `central-promocoes`. Crie uma senha forte e **anote**. Região: *South America (São Paulo)*.
3. Espere uns 2 minutos até o projeto ficar pronto.
4. No menu da esquerda, abra **SQL Editor** → **New query**.
5. Abra no GitHub o arquivo `supabase/migrations/20260101000000_init.sql`, copie **tudo**, cole no editor e clique em **Run**. Deve aparecer "Success".
6. Faça o mesmo com `supabase/migrations/20260102000000_affiliate_programs.sql`.
7. (Opcional, só para ver o site funcionando com dados de mentira) repita com `supabase/seed.sql`. **Depois, antes de lançar para valer, apague os dados de teste** em *Table Editor* (tabelas `products`, `games`, `services`, `events`).
8. Pegue as chaves: **Project Settings → API**. Anote: `Project URL`, `anon public` e `service_role` (esta é secreta, nunca mostre para ninguém).

✅ Teste: no menu **Table Editor** aparecem as tabelas `products`, `offers`, `price_history` etc.

### 1.2 Vercel (onde o site fica no ar) · grátis para começar
1. Entre em https://vercel.com com a conta do GitHub.
2. **Add New → Project** → escolha o repositório `Promocoes` → **Import**.
3. Antes de clicar em Deploy, abra **Environment Variables** e cadastre (nome = valor), uma por uma:
   - `NEXT_PUBLIC_SUPABASE_URL` = o *Project URL* do passo 1.1.8
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = a chave *anon public*
   - `SUPABASE_SERVICE_ROLE_KEY` = a chave *service_role*
   - `CRON_SECRET` = invente uma senha longa (30+ letras e números)
   - `NEXT_PUBLIC_SITE_URL` = o endereço que a Vercel vai te dar (pode ajustar depois)
4. Clique em **Deploy**. Quando terminar, a Vercel mostra o endereço do site.

### 1.3 Ligar o login ao site
No Supabase: **Authentication → URL Configuration**. Em *Site URL* coloque o endereço da Vercel. Em *Redirect URLs* coloque `https://SEU-ENDERECO/auth/callback`. Salve.

✅ Teste: abra o site → aparece a tela de login. Crie sua conta com seu e-mail.

### 1.4 Tornar a sua conta ADMIN e APOIADORA
No Supabase → **SQL Editor** → nova consulta (troque pelo seu e-mail) → **Run**:

```sql
update profiles set is_admin = true, is_supporter = true where email = 'seu@email.com';
```

Saia e entre de novo no site. Agora o menu da sua conta (canto superior direito) mostra **Admin · produtos e links**.

---

## PARTE 2 · Seus links de afiliado

Para **cada loja** você precisa se cadastrar no programa de afiliados dela e ser aprovado (isso é feito nos sites das lojas e pode levar dias). Quando tiver o código:

1. No site, menu da conta → **Admin · produtos e links**.
2. Bloco **1. Seu código de afiliado**: na linha da loja, preencha **um** dos campos:
   - **Parâmetros**: quando o programa só pede para acrescentar um código ao link. Exemplo da Amazon: `tag=seucodigo-20`.
   - **Modelo de link**: quando a rede gera um link próprio que "embrulha" o endereço do produto (é o caso das redes como Awin). Cole o modelo e troque o endereço do produto por `{url_encoded}`. Se quiser também rastrear qual apoiador clicou, use `{subid}` no campo que a rede reservar para isso.
3. Clique em **Salvar**.

Se o painel da loja só gera um link pronto por produto (acontece no Mercado Livre e na Shopee), escolha uma destas saídas:
- pergunte no próprio painel se existe um parâmetro/código fixo para acrescentar aos links (se existir, use **Parâmetros**); ou
- me peça para adicionar o campo "link manual por produto" no painel (o código já suporta; falta só a tela).

✅ Teste: abra um produto no site, clique em **Ver na loja** e confira, na barra de endereço da loja, se o seu código apareceu.

---

## PARTE 3 · Cadastrar produtos

1. **Admin · produtos e links** → bloco **2. Adicionar um produto numa loja**.
2. Cole o endereço da página do produto na loja (o site reconhece a loja sozinho e limpa o link).
3. Digite o preço de hoje (ex.: `3799,90`).
4. Escolha um produto já cadastrado **ou** escreva o nome de um novo (e a categoria).
5. **Adicionar**. Repita para o mesmo produto em outras lojas: assim aparece a comparação "Preço por loja".

O histórico de preços começa no dia do primeiro cadastro e cresce a cada dia (**o sistema não inventa passado**). Para ter oscilação de meses, é preciso esperar, ou importar um histórico de outra fonte.

### Atualizar preços
- Lojas manuais: bloco **3. Ofertas cadastradas** → digite o novo preço → **Atualizar**. Faça isso pelo menos 1× por dia.
- Mercado Livre automático: crie o aplicativo em https://developers.mercadolivre.com.br, copie o *Client ID* e o *Secret* para as variáveis `ML_CLIENT_ID` e `ML_CLIENT_SECRET` na Vercel. A partir daí os preços das ofertas cadastradas depois disso atualizam sozinhos 4× ao dia.

---

## PARTE 4 · Apoiadores (membros do YouTube)

A forma mais simples para começar é **manual**:
1. Toda semana, abra o YouTube Studio → **Monetização → Membros** e veja a lista.
2. No Supabase → **Table Editor → supporters** → **Insert row** com o e-mail de cada membro (em minúsculas).
3. Quem entrar no site com esse e-mail já vira apoiador. Para tirar o acesso: mude `active` para `false` e rode `update profiles set is_supporter = false where email = '...'`.

Limitação: o e-mail de cadastro precisa ser o mesmo que você tem na lista. Se a pessoa usar outro, você precisa liberar à mão. A automação pela API do YouTube (que não entrega e-mail e exige um vínculo extra) é um passo futuro.

---

## Se algo der errado
- **Tela branca ou erro 500 no site**: quase sempre falta uma variável da Parte 1.2. Confira os nomes (letra por letra) em Vercel → Settings → Environment Variables e faça **Redeploy**.
- **"Ainda não há produtos"**: cadastre pelo menos 1 produto (Parte 3) ou rode o `seed.sql`.
- **Não vejo o menu Admin**: refaça o passo 1.4 e saia/entre de novo.
- Copie a mensagem de erro e me envie.
