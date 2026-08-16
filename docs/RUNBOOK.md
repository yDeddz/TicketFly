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
CRON_SECRET=...                 # fallback manual: protege a rota HTTP de expiração
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

O Supabase Cron executa diretamente no banco a cada 10 minutos:

```sql
select public.expire_stale_reservations(30);
```

Configuração: migration `20260808111613_schedule_expire_stale_reservations.sql`.
Monitore em **Supabase Dashboard → Integrations → Cron** ou na tabela
`cron.job_run_details`.

A rota `/api/cron/expire-reservations` e o `CRON_SECRET` permanecem como
fallback. Em Vercel (plano com Cron), `vercel.json` chama essa rota a cada
10 minutos com `Authorization: Bearer $CRON_SECRET`.

## Ambiente de testes (homologação)

1. Copie `.env.example` para `.env.local` e preencha as chaves do **projeto Supabase do TicketFly** (não use outro projeto).
2. Para pagamentos de teste, use Asaas sandbox (`ASAAS_API_URL=https://api-sandbox.asaas.com`) **ou** credenciais de teste do Mercado Pago.
3. Rode `npm run ops:check` — precisa de QR secret e pelo menos um provedor completo.
4. Crie/aprove um organizador em `/admin/contratos` (primeiro admin via SQL acima).
5. No SQL Editor: rode `supabase/seed_test_ops.sql`.
6. Abra `/eventos/ops-teste-agosto`. Cupom `TESTE10`. Promotor `?ref=OPSTESTE`.
7. Compre, confirme webhook, abra o QR, valide em `/checkin`.
8. Aplique as migrations pendentes de porta e expiração de reserva antes de vender na entrada.

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
| Estoque travado | Rodar cron `expire-reservations` |
