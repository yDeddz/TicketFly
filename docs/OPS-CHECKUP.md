# Checkup operacional — TicketFly (16/08/2026)

Meta: vender e validar ingresso até 31/08. Trabalho local neste repo (`yDeddz/TicketFly`).

## O que está pronto

- Compra online → webhook → ingresso com QR rotativo (~90s) + código manual
- Check-in por câmera ou código `XXXX-XXXX`
- Painel do organizador: eventos, lotes, cupons, promotores, reembolsos, webhooks
- Admin: contratos e taxa
- Vendas na porta (Asaas) + página `/pagar/[token]`
- Expiração de reservas (pg_cron + rota HTTP)

## Blockers para o mês

| Prioridade | Item | Ação |
|---|---|---|
| P0 | Código ainda não está no ar do yDeddz | Push para `yDeddz/TicketFly` — `ticket-fly.vercel.app` só atualiza depois |
| P0 | `NEXT_PUBLIC_APP_URL` | Já aponta para `https://ticket-fly.vercel.app` (webhooks/QR) |
| P0 | Migrations de porta + cron ainda não commitadas | Aplicar no Supabase do TicketFly e subir o código |
| P0 | Webhooks MP/Asaas | Sem isso o pagamento fica `pending` e o QR não sai |
| P1 | Primeiro admin | `update public.users set role = 'admin' where email = '...'` |
| P1 | Vendas na porta | Organizador precisa conectar Asaas |
| P2 | E-mail de ingresso | Ainda não há envio transacional — comprador usa `/status` e `/painel` |

## Correções feitas neste checkup

- Checkout exige nome e e-mail reais (sem placeholder `@checkout.ticketfly.app`)
- Copy de pagamento deixa de falar só Mercado Pago
- `?cupom=` aplica sozinho; `?ref=` já atribuía promotor
- Publicar evento exige lote ativo
- Novo contrato envia e-mail de senha
- Proteção de compra passa a ser opt-in, com aviso de que não é apólice
- Seed + `npm run ops:check` + testes de taxa/checkout/provedor
- Cron HTTP no `vercel.json` como rede de segurança

## Organizador (painel /organizador)

1. Conectar Asaas (porta + split) ou Mercado Pago em **Pagamentos**. Sem isso o dinheiro não cai na casa.
2. Criar evento → lote → publicar (sem lote a publicação é bloqueada).
3. Cupom `TESTE10` e promotor `OPSTESTE` vêm do seed.
4. Porta: **Bilheteria na Porta** só com Asaas conectado.
5. Check-in: organizador já entra em `/checkin`. Staff extra em `/admin/equipe`.

## Admin (painel /admin)

1. Primeiro admin: `update public.users set role = 'admin' where email = '...';`
2. **Contratos**: aprovar casa, limiar da taxa em **reais** (não centavos).
3. Novo contrato envia e-mail para o parceiro definir senha.
4. **Equipe porta**: libera `/checkin` para operadores que já têm conta.
5. Checklist na visão geral: pendências de contrato, provedor, evento e pagamentos pending.

## Domínio

O site público do yDeddz é `https://ticket-fly.vercel.app`. Mudança local **não** aparece lá até dar push em `yDeddz/TicketFly`.

Passo a passo compartilhado: [`PLANO-GO-LIVE.md`](PLANO-GO-LIVE.md).

- **16–18:** env local, seed, 1 compra sandbox ponta a ponta
- **19–22:** webhooks no domínio de homologação, Asaas/MP da balada, check-in no celular
- **23–26:** porta (Asaas), reembolso de teste, cron de reservas
- **27–29:** ensaio de porta com 1 ingresso pago + 1 recusa + 1 duplicado
- **30–31:** go/no-go. Sem webhook verde, não abre venda pública
