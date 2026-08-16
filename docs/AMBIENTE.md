# Mapa do ambiente — TicketFly

Uma fonte de verdade para **Leonardo** e **André (yDeddz)**.  
Se algo “não comunica” (webhook, login, cron, QR), o host está errado.

## Produção (única)

| Peça | Valor canônico | Não usar |
|---|---|---|
| Site público | https://www.ticketfly.app | `ticket-fly.vercel.app` (atalho técnico), `ticketfly.vercel.app` (Vercel do Leonardo) |
| GitHub | [`yDeddz/TicketFly`](https://github.com/yDeddz/TicketFly) `main` | `realg333/ticketfly` |
| Vercel | time **ticket-fly**, projeto **ticket-fly**, Hobby, domínio `www.ticketfly.app` | time `realg333's projects`, projeto `ticketfly` |
| Supabase | TicketFly ref `cbgcukhyytifirlvoygr` (André) | `DIRETORIA DOS MLK` (`kxtpcsxwwdqsffenkcjn`) |
| Pagamento | Asaas `https://api.asaas.com` | sandbox no ar |
| Cron 10 min | site externo → rota HTTP abaixo | `vercel.json` com `*/10` (quebra Hobby) |
| `NEXT_PUBLIC_APP_URL` | `https://www.ticketfly.app` | `ticket-fly.vercel.app`, localhost na Production |

O `.env.local` desta pasta é espelho disso (mesmo Supabase). `npm run dev` fala com o **banco de produção**.

Hobby não deixa convidar o Leonardo no time Vercel. Código sobe por **push no GitHub**. Env na Vercel o André cola em massa (abaixo). Pro é opcional.

## Env em massa na Vercel do André

Sim: a Vercel aceita [upload/cola de um `.env` inteiro](https://vercel.com/changelog/bulk-upload-now-available-for-environment-variables).

**Leonardo (nesta pasta):**

```bash
npm run ops:export-env
```

Gera `.env.vercel.import` (já no `.gitignore`, **não** commitar, **não** mandar no GitHub).  
`NEXT_PUBLIC_APP_URL` sai forçado como `https://www.ticketfly.app`. MP placeholder é pulado.

**André, logado na Vercel dele:**

1. Abrir [ticket-fly → Environment Variables](https://vercel.com/ticket-fly/ticket-fly/settings/environment-variables)
2. Colar o conteúdo do arquivo **ou** Import `.env`
3. Marcar **Production** (e Preview se for o mesmo banco)
4. Se `NEXT_PUBLIC_APP_URL` já existir com `ticket-fly.vercel.app`, **editar** para `https://www.ticketfly.app`
5. **Deployments** → último Production → ⋮ → **Redeploy** (env nova não entra no deploy antigo)

Não dá para o Leonardo empurrar env pela CLI: o time `ticket-fly` é Hobby, só o André tem o dashboard.

## Comunicação (mesmo host)

```
comprador
    → https://www.ticketfly.app
         → Vercel Hobby (projeto ticket-fly)
         → Supabase cbgcukhyytifirlvoygr
         → Asaas api.asaas.com

Asaas  → POST https://www.ticketfly.app/api/webhooks/asaas
cron   → GET/POST https://www.ticketfly.app/api/cron/expire-reservations
Auth   → https://www.ticketfly.app/auth/callback
```

## Lista de env (Production = `.env.local`)

```txt
NEXT_PUBLIC_APP_URL=https://www.ticketfly.app
NEXT_PUBLIC_SUPABASE_URL=https://cbgcukhyytifirlvoygr.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
TICKET_QR_SECRET=...            # ≥32, não reutilizar a service role
ASAAS_API_KEY=...
ASAAS_API_URL=https://api.asaas.com
ASAAS_WEBHOOK_TOKEN=...
CRON_SECRET=...                 # mesmo header do job externo
```

Mercado Pago só se for usar (`MERCADO_PAGO_*`). Hoje Asaas basta.

Local: `npm run ops:check`

## Cron externo (Hobby)

| Campo | Valor |
|---|---|
| URL | `https://www.ticketfly.app/api/cron/expire-reservations` |
| Método | GET ou POST |
| Header | `Authorization: Bearer <CRON_SECRET>` ou `x-cron-secret: <CRON_SECRET>` |
| Intervalo | a cada 10 minutos |

Função SQL: `supabase/migrations/20260804160000_expire_stale_reservations.sql`.  
**Não** aplicar a migration de `pg_cron`.

## Auth no Supabase (André)

Site URL: `https://www.ticketfly.app`

Redirects:

- `https://www.ticketfly.app/auth/callback`
- `https://www.ticketfly.app/auth/reset`
- `https://www.ticketfly.app/redefinir-senha`
- `https://ticketfly.app/auth/callback` (se o apex não redirecionar)
- `http://localhost:3000/auth/callback`
- `http://localhost:3000/redefinir-senha`

## Webhooks Asaas (André)

- URL: `https://www.ticketfly.app/api/webhooks/asaas`
- Token = `ASAAS_WEBHOOK_TOKEN` da Vercel

MP se for ligar: `https://www.ticketfly.app/api/webhooks/mercado-pago`

## Banco (SQL Editor do TicketFly, André)

1. `20260804160000_expire_stale_reservations.sql`
2. `20260808112824_door_sales_atomic_flow.sql`
3. Não rodar `pg_cron`
4. `update public.users set role = 'admin' where email = '...';`

## Checklist

- [ ] Aberto = [www.ticketfly.app](https://www.ticketfly.app)
- [ ] `NEXT_PUBLIC_APP_URL` na Vercel = `https://www.ticketfly.app`
- [ ] Webhook Asaas e cron externo nesse host
- [ ] Auth URLs no Supabase com `www.ticketfly.app`
- [ ] Função `expire_stale_reservations` no banco
- [ ] Ninguém testa em `ticketfly.vercel.app` nem no DIRETORIA DOS MLK
