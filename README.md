# PinkPass

MVP de bilheteria online para eventos locais com Next.js, Supabase, Mercado Pago, QR Code único e check-in web/PWA.

## Arquitetura

- Frontend: Next.js App Router, React, Tailwind CSS e componentes client apenas onde há interação.
- Backend: Route Handlers do Next.js em `/api/*`.
- Banco/Auth: Supabase Auth + Postgres + RLS.
- Pagamentos: Mercado Pago Checkout Pro com criação de preferência no backend e webhook como fonte da verdade.
- QR Code: gerado a partir de `tickets.qr_token`, liberado apenas quando o status do ingresso vira `paid`.
- Check-in: web app em `/checkin`, usando câmera via `html5-qrcode` e validação transacional no Postgres.

## Estrutura

```txt
src/app
  api/checkout
  api/webhooks/mercado-pago
  api/checkin/validate
  api/payments/[id]/status
  api/organizer/*
  api/admin/*
  eventos/[slug]
  ingressos/[code]
  status/[id]
  organizador
  admin
  checkin
src/components
src/lib
supabase/schema.sql
```

## Banco de Dados

O schema completo está em `supabase/schema.sql` e inclui:

- Tabelas: `users`, `organizers`, `events`, `ticket_batches`, `tickets`, `payments`, `checkins`, `promoters`, `promoter_sales`, `webhook_deliveries`.
- Enums de status para usuário, organizador, evento, ingresso, pagamento, check-in e entrega de webhook.
- Índices para eventos por slug/data, lotes ativos, pagamentos, ingressos por status, check-ins por evento e outbox de webhooks.
- RLS por perfil: cliente, organizador aprovado, admin e operador de check-in.
- Funções transacionais:
  - `reserve_ticket`: bloqueia o lote, reserva 1 ingresso e impede oversell por corrida simples.
  - `apply_payment_status`: confirma ou libera reserva conforme status do Mercado Pago.
  - `perform_checkin`: valida QR, marca como usado e impede uso duplicado com `for update`.
- Webhooks outbound: o parceiro configura URL + secret em `/organizador/webhooks` e recebe `sale.completed`, `sale.refunded` e eventos de ciclo de vida (`event.*`) assinados com HMAC-SHA256.

## Rotas/API

- `POST /api/checkout`: reserva ingresso, cria `payment`, cria preferência Mercado Pago e retorna `checkoutUrl`.
- `POST /api/webhooks/mercado-pago`: valida assinatura, busca pagamento na API do Mercado Pago e atualiza banco.
- `GET /api/payments/[id]/status`: retorna status local do pagamento.
- `POST /api/checkin/validate`: valida QR Code e retorna uma das mensagens de check-in.
- `POST /api/organizer/events`: cria evento para organizador aprovado.
- `POST /api/organizer/batches`: cria lote de ingresso.
- `GET /api/organizer/export?eventId=...`: exporta compradores em CSV.
- `GET/PATCH/POST /api/organizer/webhooks`: configura endpoint do parceiro, rotaciona secret e envia ping de teste.
- `POST /api/admin/tickets/[id]/cancel`: cancela ingresso.

## Fluxo de Compra

1. Cliente acessa `/eventos/[slug]`.
2. Escolhe lote e preenche nome/e-mail.
3. Frontend chama `POST /api/checkout`.
4. Backend executa `reserve_ticket`, cria `payments`, vincula `tickets.payment_id` e cria uma preferência Mercado Pago.
5. Cliente é redirecionado para `init_point`.
6. Mercado Pago envia webhook `payment`.
7. Backend valida `x-signature`, busca o pagamento em `/v1/payments/[ID]`, lê `external_reference` e executa `apply_payment_status`.
8. Se aprovado, ingresso vira `paid`, reserva vira venda e a página `/ingressos/[code]` mostra o QR Code.
9. Se o parceiro tiver webhook ativo, a Ticket Fly enfileira `sale.completed` em `webhook_deliveries` e POSTA o payload assinado para a URL configurada.

## Fluxo de Check-in

1. Operador logado com papel `admin`, `organizer` ou `checkin` abre `/checkin`.
2. A câmera lê o QR Code ou o operador digita o código manualmente.
3. `POST /api/checkin/validate` chama `perform_checkin`.
4. O banco bloqueia a linha do ingresso e responde:
   - `Ingresso válido`
   - `Ingresso já usado`
   - `Ingresso cancelado`
   - `Ingresso não encontrado`
   - `Pagamento ainda não confirmado`

## Mercado Pago

O MVP usa Checkout Pro porque é mais rápido para validar e reduz escopo PCI no início.

- Criação da preferência: `src/app/api/checkout/route.ts`
  - `items`: ingresso comprado.
  - `payer`: nome/e-mail do comprador.
  - `external_reference`: `payments.id`.
  - `notification_url`: `/api/webhooks/mercado-pago?source_news=webhooks`.
  - `back_urls`: `/status/[paymentId]`.
- Webhook: `src/app/api/webhooks/mercado-pago/route.ts`
  - Valida HMAC em `x-signature`.
  - Usa `x-request-id` e `data.id`.
  - Consulta o pagamento completo no Mercado Pago.
  - Atualiza `payments` e `tickets`.

Referências oficiais consultadas:

- Checkout Pro Preferences: https://www.mercadopago.com.br/developers/en/reference/online-payments/checkout-pro/preferences/create-preference/post
- Webhooks Checkout Pro: https://www.mercadopago.com.co/developers/en/docs/checkout-pro/additional-content/notifications/webhooks

## Segurança

- RLS habilitado em todas as tabelas públicas.
- `service_role` fica apenas no servidor, nunca no browser.
- Validação server-side com Zod nas rotas críticas.
- QR usa `qr_token` aleatório, não dados previsíveis do cliente.
- Check-in transacional com bloqueio de linha impede dois usos simultâneos.
- Webhook exige assinatura HMAC do Mercado Pago.
- Webhooks outbound do parceiro usam `X-TicketFly-Signature` = HMAC-SHA256(secret, `timestamp.body`).
- O status de pagamento válido vem do webhook + consulta à API do provedor, não do redirect do navegador.

## Variáveis de Ambiente

Copie `.env.example` para `.env.local`:

```txt
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
MERCADO_PAGO_ACCESS_TOKEN=
MERCADO_PAGO_WEBHOOK_SECRET=
```

A taxa de serviço **não** vem mais do env. O padrão global é:

- pedidos até R$ 120,00 → **12%**
- pedidos acima de R$ 120,00 → **9%**

Contratos por balada ficam em `organizers` (`fee_threshold_cents`, `fee_percent_upto_threshold`, `fee_percent_above_threshold`) e são editáveis no painel admin. O comprador paga **ingresso + taxa**; o líquido do ingresso vai para a balada e a taxa fica com a Ticket Fly.

## Ordem Exata de Desenvolvimento

1. Criar projeto Supabase.
2. Rodar `supabase/schema.sql` no SQL Editor.
3. Configurar Supabase Auth com magic link.
4. Criar um usuário admin atualizando `users.role = 'admin'`.
5. Criar/solicitar organizador em `organizers`.
6. Aprovar organizador e configurar contrato de taxa no painel `/admin` (ou `status = 'approved'` no DB).
7. Criar evento e lote.
8. Publicar evento com `events.status = 'published'`.
9. Configurar credenciais do Mercado Pago (token global por enquanto; Connect por balada em breve).
10. Configurar webhook no painel Mercado Pago.
11. Comprar ingresso de teste (total = ingresso + taxa de serviço).
12. Validar webhook e QR Code.
13. Testar check-in duplicado.
14. Subir para Vercel.

## Deploy Vercel

- Criar projeto na Vercel apontando para este repositório.
- Adicionar todas as variáveis de ambiente.
- Confirmar `NEXT_PUBLIC_APP_URL` com o domínio HTTPS final.
- No Mercado Pago, configurar webhook de produção para `https://seu-dominio.com/api/webhooks/mercado-pago`.
- Selecionar evento/tópico `payment`.
- Testar notificação no painel do Mercado Pago.
- Fazer compra real pequena em produção.
- Confirmar que o ingresso virou `paid`.
- Escanear o QR no celular.

## Checklist de Produção

### Supabase

1. Crie um projeto no Supabase.
2. Abra o SQL Editor e execute `supabase/schema.sql`.
3. Em Authentication > URL Configuration:
   - Site URL: `https://seu-dominio.com`
   - Redirect URLs: `https://seu-dominio.com/**` (inclui `/auth/callback` e `/auth/reset` usados no login e na recuperação de senha)
4. Copie as chaves do projeto:
   - Project URL -> `NEXT_PUBLIC_SUPABASE_URL`
   - anon public -> `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - service_role -> `SUPABASE_SERVICE_ROLE_KEY`
5. Crie seu usuário pelo login do site.
6. Depois que o usuário existir, rode no SQL Editor:

```sql
update public.users
set role = 'admin'
where email = 'seu-email@dominio.com';
```

### Mercado Pago

1. Crie uma aplicação no painel de desenvolvedores do Mercado Pago.
2. Copie o Access Token de produção para `MERCADO_PAGO_ACCESS_TOKEN`.
3. Configure o webhook da aplicação:
   - URL: `https://seu-dominio.com/api/webhooks/mercado-pago`
   - Evento/tópico: `payment`
4. Copie a chave secreta do webhook para `MERCADO_PAGO_WEBHOOK_SECRET`.
5. Faça uma compra pequena em produção e confirme no Supabase:
   - `payments.status = approved`
   - `tickets.status = paid`

### Vercel

Configure as variáveis em Project Settings > Environment Variables:

```txt
NEXT_PUBLIC_APP_URL=https://seu-dominio.com
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-chave-anon
SUPABASE_SERVICE_ROLE_KEY=sua-chave-service-role
MERCADO_PAGO_ACCESS_TOKEN=APP_USR-seu-access-token
MERCADO_PAGO_WEBHOOK_SECRET=sua-chave-secreta-webhook
```

Nunca envie `.env.local`, `SUPABASE_SERVICE_ROLE_KEY`, `MERCADO_PAGO_ACCESS_TOKEN` ou `MERCADO_PAGO_WEBHOOK_SECRET` para o GitHub.

## Melhorias Futuras

- Carrinho com múltiplos ingressos por compra (limiar de taxa sobre o subtotal).
- Expiração automática de reservas pendentes.
- Mercado Pago Connect / Checkout Pro Marketplace: cobrir no collector da balada com `marketplace_fee` = taxa Ticket Fly.
- Cupons, promoters com comissão configurável por evento e relatórios financeiros.
- Reembolso integrado.
- PWA installable com manifest e cache offline para check-in.
- Tipos gerados do Supabase com `supabase gen types typescript`.
- Worker/cron para reprocessar `webhook_deliveries` pendentes com backoff.
