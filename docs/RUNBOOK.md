# Runbook operacional — PinkPass / TicketFly

Checklist para produção estável (pagamentos, QR e porta).

## Variáveis obrigatórias

```txt
NEXT_PUBLIC_APP_URL=https://seu-dominio.com
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
TICKET_QR_SECRET=<≥32 chars aleatórios — NÃO reutilize a service role>
MERCADO_PAGO_ACCESS_TOKEN=APP_USR-...
MERCADO_PAGO_WEBHOOK_SECRET=...
```

### Se usar Asaas

```txt
ASAAS_API_KEY=...
ASAAS_API_URL=https://api.asaas.com
ASAAS_WEBHOOK_TOKEN=...
```

Em produção, sandbox Asaas e token de webhook ausente **bloqueiam** chamadas Asaas.

### Opcionais

```txt
CRON_SECRET=...                 # obrigatório: mesmo valor no job externo e na Vercel
ALLOW_LEGACY_HEX_QR=false       # default em prod: legado hex desligado
MERCADO_PAGO_CLIENT_ID=...      # MP Connect organizador
MERCADO_PAGO_CLIENT_SECRET=...
```

## Webhooks

| Provedor | URL | Nota |
|---|---|---|
| Mercado Pago | `https://seu-dominio.com/api/webhooks/mercado-pago` | tópico `payment` + secret |
| Asaas | `https://seu-dominio.com/api/webhooks/asaas` | header com `ASAAS_WEBHOOK_TOKEN` |

Sem webhook correto, pagamentos ficam `pending` e o QR não libera.

## Reservas órfãs

O plano Vercel é **Hobby**: cron `*/10` no `vercel.json` **falha o deploy**.
O agendamento a cada 10 minutos é um **site externo** batendo na rota HTTP.

```txt
GET ou POST https://www.ticketfly.app/api/cron/expire-reservations
Authorization: Bearer <CRON_SECRET>
# ou: x-cron-secret: <CRON_SECRET>
```

A rota chama `select public.expire_stale_reservations(30);` no Supabase do yDeddz.
A função vem de `20260804160000_expire_stale_reservations.sql`. Não usar `pg_cron`.

Mapa completo (hosts, env, Auth, Asaas): [`AMBIENTE.md`](AMBIENTE.md).

## Ambiente de testes (homologação)

1. Copie `.env.example` para `.env.local` e preencha as chaves do **projeto Supabase do TicketFly** (não use outro projeto).
2. Para pagamentos de teste, use Asaas sandbox (`ASAAS_API_URL=https://api-sandbox.asaas.com`) **ou** credenciais de teste do Mercado Pago.
3. Rode `npm run ops:check` — precisa de QR secret e pelo menos um provedor completo.
4. Crie/aprove um organizador em `/admin/contratos` (primeiro admin via SQL acima).
5. No SQL Editor: rode `supabase/seed_test_ops.sql`.
6. Abra `/eventos/ops-teste-agosto`. Cupom `TESTE10`. Promotor `?ref=OPSTESTE`.
7. Compre, confirme webhook, abra o QR, valide em `/checkin`.
8. yDeddz aplica no SQL Editor do TicketFly a função `expire_stale_reservations` e a migration de porta (não o `pg_cron`). Ver [`AMBIENTE.md`](AMBIENTE.md).

Passo a passo compartilhado (Leonardo + yDeddz, calendário até 31/08): [`PLANO-GO-LIVE.md`](PLANO-GO-LIVE.md).

## Rotação de `TICKET_QR_SECRET`

1. Avise a operação: QRs ao vivo e Wallets assinados com o secret antigo deixam de validar.
2. Troque o secret no provedor de env.
3. Redeploy.
4. Compradores precisam atualizar a tela do ingresso / regenerar Wallet.

## Admin bootstrap

No SQL do Supabase:

```sql
update public.users set role = 'admin' where email = 'seu@email.com';
```

## Checklist pré-evento (porta)

- [ ] Operador logado com papel `admin`, `organizer` ou `checkin`
- [ ] Evento correto selecionado em `/checkin`
- [ ] Câmera funciona; modo “Digitar código” testado (código `XXXX-XXXX`)
- [ ] Rede estável; fallback 4G se Wi‑Fi da casa falhar
- [ ] Um ingresso de teste pago validado (e reembolsado depois, se necessário)
- [ ] Confirmado que `TICKET_QR_SECRET` não mudou desde o início das vendas

## Sintomas → ação

| Sintoma | Ação |
|---|---|
| Pagamento pago no provedor, ingresso `pending` | Conferir webhook + secret; abrir `/status/[id]` e “Já paguei” |
| QR “expirado” na porta | Pedir atualizar tela do ingresso (TTL ~90s) |
| “QR legado não aceito” | Usar QR ao vivo `PP1.*` ou código manual |
| Reembolso “parcial” | Ingresso cancelado localmente; estornar manualmente no MP/Asaas |
| Estoque travado | Conferir job externo + `CRON_SECRET` + função SQL (docs/AMBIENTE.md) |
