# Mapa do ambiente — TicketFly

Uma fonte de verdade para **Leonardo** e **yDeddz**.  
Se algo “não comunica” (webhook, login, cron, QR), é quase sempre um apontamento fora desta tabela.

## Produção (única)

| Peça | Valor canônico | Não usar |
|---|---|---|
| GitHub | [`yDeddz/TicketFly`](https://github.com/yDeddz/TicketFly) `main` | `realg333/ticketfly` |
| Site | https://ticket-fly.vercel.app | https://ticketfly.vercel.app |
| Vercel | time **ticket-fly**, projeto **ticket-fly**, plano **Hobby** | time `realg333's projects`, projeto `ticketfly` |
| Supabase | projeto **TicketFly** ref `cbgcukhyytifirlvoygr` (conta do yDeddz) | `DIRETORIA DOS MLK` (`kxtpcsxwwdqsffenkcjn`) — vazio |
| Pagamento ativo | Asaas **produção** `https://api.asaas.com` | sandbox `api-sandbox.asaas.com` no ar |
| Cron 10 min | **site externo** → rota HTTP (abaixo) | Cron da Vercel (`vercel.json`) — Hobby só aceita 1×/dia e **quebra o deploy** se for `*/10` |
| `NEXT_PUBLIC_APP_URL` | `https://ticket-fly.vercel.app` | localhost no env de Production da Vercel |

Fonte da verdade do **ar** = Vercel do yDeddz (time `ticket-fly`) + Supabase do yDeddz.  
O `.env.local` desta pasta é **espelho** disso (já aponta para `ticket-fly.vercel.app` e `cbgcukhyytifirlvoygr`). `npm run dev` fala com o banco de produção.

A Vercel `ticketfly` / `realg333's projects` **não entra** em deploy, env nem teste.

## Como alinhamos na prática

Hoje o Leonardo tem write no GitHub, mas **não** está no time Vercel `ticket-fly` nem no Supabase TicketFly (API). Sem esses dois convites, ninguém daqui consegue ler/editar env de produção — só o yDeddz no dashboard.

### 1) yDeddz libera acesso (uma vez)

**Vercel** (conta que tem o projeto [ticket-fly](https://vercel.com/ticket-fly/ticket-fly)):

1. Team Settings → Members → Invite `leonardo.giancotti@gmail.com` como **Member**
2. Confirmar que o Git do projeto é `yDeddz/TicketFly` / branch `main`
3. Production → Environment Variables: os nomes da lista abaixo, **Production** (e Preview se quiser o mesmo banco)

**Supabase** (projeto TicketFly, ref `cbgcukhyytifirlvoygr`):

1. Project Settings → Members → Invite o mesmo e-mail como **Developer**
2. Authentication → URL Configuration: Site URL + redirects desta página

Manda no zap, se preferir:

```txt
Me adiciona no time Vercel ticket-fly (Member) e no Supabase do TicketFly (Developer).
O site de verdade é só ticket-fly.vercel.app — a Vercel ticketfly do Leonardo a gente ignora.
```

### 2) Depois do convite (Leonardo)

1. Aceitar e-mail da Vercel e do Supabase
2. Reconectar o MCP/login da Vercel nesta máquina
3. **Não** rodar `vercel link` no projeto `ticketfly` do realg333
4. Se for linkar CLI: time `ticket-fly`, projeto `ticket-fly` (Hobby)
5. `npm run ops:check` — tem que mostrar host `ticket-fly.vercel.app` e ref `cbgcukhyytifirlvoygr`

Aí dá para conferir env Production, logs de deploy e SQL sem o yDeddz colar segredo no chat.

### 3) Conferência que o yDeddz faz sozinho (se o convite atrasar)

No dashboard **dele**, projeto `ticket-fly` → Settings → Environment Variables → Production:

| Variável | Tem que ser |
|---|---|
| `NEXT_PUBLIC_APP_URL` | `https://ticket-fly.vercel.app` |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://cbgcukhyytifirlvoygr.supabase.co` |
| `ASAAS_API_URL` | `https://api.asaas.com` |
| `CRON_SECRET` | o **mesmo** do job no site externo |
| `ASAAS_WEBHOOK_TOKEN` | o **mesmo** do webhook no Asaas |
| resto da lista abaixo | preenchido, sem sandbox |

Deploy: só o que o GitHub `yDeddz/TicketFly` `main` dispara nesse projeto. Ninguém dá `vercel --prod` pela conta do Leonardo.

### 4) Comunicação (Asaas + cron + Auth)

Tudo aponta para o host da Vercel **dele**:

- Webhook Asaas → `https://ticket-fly.vercel.app/api/webhooks/asaas`
- Cron externo → `https://ticket-fly.vercel.app/api/cron/expire-reservations`
- Login/recovery → `https://ticket-fly.vercel.app/auth/callback` (Supabase)

Se qualquer um desses URLs for `ticketfly.vercel.app` (sem hífen) ou um `*.vercel.app` de preview, o pagamento/cron/login “não comunica”.

## Quem aponta para quem

```
comprador / casa
    → https://ticket-fly.vercel.app          (Vercel Hobby, yDeddz)
         → Supabase cbgcukhyytifirlvoygr     (Auth, Postgres, RLS)
         → Asaas api.asaas.com               (Pix/cartão, split, porta)

Asaas
    → POST https://ticket-fly.vercel.app/api/webhooks/asaas
      header asaas-access-token = ASAAS_WEBHOOK_TOKEN (igual na Vercel)

cron externo (a cada 10 min)
    → GET ou POST https://ticket-fly.vercel.app/api/cron/expire-reservations
      Authorization: Bearer CRON_SECRET
      (ou header x-cron-secret: CRON_SECRET)
         → RPC public.expire_stale_reservations(30)

Supabase Auth
    → redirect https://ticket-fly.vercel.app/auth/callback
    → recovery  https://ticket-fly.vercel.app/auth/reset
```

Sem o webhook do Asaas no **mesmo** host e token da Vercel, o Pix confirma no Asaas e o ingresso fica `pending`.  
Sem o cron externo (ou com `CRON_SECRET` diferente), reserva órfã trava estoque.

## Env que tem que ser **igual** na Vercel Production e no `.env.local`

Não commitar valores. Só conferir nomes e que Production **não** está em sandbox.

```txt
NEXT_PUBLIC_APP_URL=https://ticket-fly.vercel.app
NEXT_PUBLIC_SUPABASE_URL=https://cbgcukhyytifirlvoygr.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
TICKET_QR_SECRET=...            # ≥32, não reutilizar a service role
ASAAS_API_KEY=...
ASAAS_API_URL=https://api.asaas.com
ASAAS_WEBHOOK_TOKEN=...
CRON_SECRET=...                 # o mesmo header que o site externo envia
```

Mercado Pago só se for usar de verdade (`MERCADO_PAGO_*`). Hoje o local está com Asaas completo e MP incompleto — ok.

Conferir local: `npm run ops:check` (imprime o ref do Supabase e recusa o projeto errado).

## Cron externo (Hobby)

A Vercel **não** agenda a cada 10 minutos neste plano. Por isso o job vive fora.

No painel do site de cron, o job tem que estar assim:

| Campo | Valor |
|---|---|
| URL | `https://ticket-fly.vercel.app/api/cron/expire-reservations` |
| Método | GET ou POST |
| Header | `Authorization: Bearer <CRON_SECRET>` **ou** `x-cron-secret: <CRON_SECRET>` |
| Intervalo | a cada 10 minutos |
| Host | só `ticket-fly.vercel.app` — nunca `ticketfly.vercel.app` nem preview |

`CRON_SECRET` na Vercel Production **tem que ser o mesmo** do job. Se o site de cron não mandar header, a rota responde 401 e o estoque não libera.

A função SQL `expire_stale_reservations` precisa existir no banco (arquivo `supabase/migrations/20260804160000_expire_stale_reservations.sql`).  
**Não** aplicar `20260808111613_schedule_expire_stale_reservations.sql` (`pg_cron`) — duplica o combinado do cron externo.

## Auth no dashboard Supabase (yDeddz)

Authentication → URL Configuration:

- Site URL: `https://ticket-fly.vercel.app`
- Redirect URLs:
  - `https://ticket-fly.vercel.app/auth/callback`
  - `https://ticket-fly.vercel.app/auth/reset`
  - `https://ticket-fly.vercel.app/redefinir-senha`
  - `http://localhost:3000/auth/callback` (dev)
  - `http://localhost:3000/redefinir-senha`

## Webhooks Asaas (yDeddz)

- URL: `https://ticket-fly.vercel.app/api/webhooks/asaas`
- Token = `ASAAS_WEBHOOK_TOKEN` da Vercel
- Eventos de pagamento (received / confirmed / refunded / overdue)

Se for ligar Mercado Pago: `https://ticket-fly.vercel.app/api/webhooks/mercado-pago` (tópico `payment`) + o mesmo secret da Vercel.

## Banco — o que o yDeddz aplica no SQL Editor do TicketFly

Ordem:

1. `supabase/migrations/20260804160000_expire_stale_reservations.sql` (obrigatório para o cron HTTP)
2. `supabase/migrations/20260808112824_door_sales_atomic_flow.sql` (porta)
3. **Não** rodar a migration de `pg_cron` / schedule
4. Primeiro admin: `update public.users set role = 'admin' where email = '...';`
5. Seed só se for homologar: `supabase/seed_test_ops.sql`

O check **Supabase Preview** no GitHub (`Remote migration versions not found in local`) é o GitHub Integration dessincronizado — **não** é o banco que o site usa via env. Não “consertar” apontando o Integration para `DIRETORIA DOS MLK`. yDeddz: ou desliga o Preview, ou convida Leonardo no projeto `cbgcukhyytifirlvoygr` e alinhamos `schema_migrations`.

## Checklist de comunicação (os dois)

- [ ] Leonardo está no time Vercel **ticket-fly** (não no `ticketfly` dele)
- [ ] Site aberto = `ticket-fly.vercel.app` (FAQ já fala Pix/cartão)
- [ ] Vercel Production com `NEXT_PUBLIC_APP_URL` e Supabase **TicketFly** (não outro projeto)
- [ ] `CRON_SECRET` Vercel = header do job externo; job no host certo
- [ ] Webhook Asaas no mesmo host + mesmo token
- [ ] Auth redirect URLs no Supabase incluem o domínio com hífen
- [ ] Função `expire_stale_reservations` existe no banco do yDeddz
- [ ] Ninguém testa venda no `ticketfly.vercel.app` nem no Supabase DIRETORIA DOS MLK
