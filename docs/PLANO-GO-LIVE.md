 
 
 # Plano de go-live — TicketFly

Documento para **Leonardo (ops/plataforma)** e **yDeddz (dono do repo e do domínio)**.  
Meta: vender e validar ingresso de verdade até **31/08/2026**.

Site público: [https://ticket-fly.vercel.app](https://ticket-fly.vercel.app)  
Repo certo: `github.com/yDeddz/TicketFly`  
Não usar: `realg333/ticketfly` nem `ticketfly.vercel.app` (cópia antiga).

Mapa do ambiente (Vercel Hobby, Supabase do yDeddz, cron externo, webhooks): [`AMBIENTE.md`](AMBIENTE.md).

---

## Quem faz o quê

| Pessoa | Papel | O que é responsabilidade dela |
|---|---|---|
| **yDeddz** | Dono do GitHub + Vercel Hobby + Supabase TicketFly | Env Production, webhook Asaas, Auth URLs, job de cron **externo**, SQL no projeto `cbgcukhyytifirlvoygr` |
| **Leonardo** | Ops da plataforma + código | Admin no painel, contrato da casa, checklist, seed de teste, conferir compra → QR → check-in |
| **Casa / organizador** | Quem vende o evento | Conectar Asaas (ou MP), criar evento + lote, publicar, ensaiar porta |

Se a “casa” for o próprio yDeddz, ele faz as duas colunas (GitHub e organizador).

---

## O que já existe no código (e no ar em ticket-fly.vercel.app)

- Compra com nome/e-mail reais → pagamento → QR rotativo (~90s) + código manual
- Check-in por câmera ou código `XXXX-XXXX`
- Painel do organizador (eventos, lotes, cupons, promotores, porta, reembolso)
- Painel admin (contratos, eventos, equipe de porta, pagamentos)
- Checklist operacional nos dois painéis
- Vendas na porta (Asaas) em `/pagar/[token]`
- Seed de teste: `supabase/seed_test_ops.sql`

O que **ainda não existe** (não bloquear o 1º evento):

- E-mail automático do ingresso — o comprador usa `/status` e `/painel` com o mesmo e-mail da compra

---

## Calendário

| Quando | O quê | Quem |
|---|---|---|
| **16–18/08** | Subir o código, env Vercel, admin no banco, 1 compra teste | yDeddz + Leonardo |
| **19–22/08** | Webhook Asaas (e MP se for usar), casa conecta provedor, evento + lote publicados | yDeddz + casa |
| **23–26/08** | Porta: PIX na entrada, reembolso de 1 ingresso teste; conferir cron **externo** | casa + Leonardo |
| **27–29/08** | Ensaio de porta: 1 pago, 1 recusa, 1 QR duplicado, 1 código manual | os dois + operador |
| **30–31/08** | Go / no-go. Sem webhook verde, **não** abre venda pública | os dois |

---

## Passo a passo

### 1) Código e env (já no GitHub `main`)

O deploy Hobby **não** pode ter cron `*/10` no `vercel.json` — isso derruba o build. O agendamento de 10 min é o **site externo** ([`AMBIENTE.md`](AMBIENTE.md)).

Conferir: [ticket-fly.vercel.app/ajuda](https://ticket-fly.vercel.app/ajuda) fala Pix/cartão (não só Mercado Pago).

Env **obrigatório na Vercel** (Production) — **os mesmos nomes** do `.env.local`, apontando para o Supabase `cbgcukhyytifirlvoygr`:

```txt
NEXT_PUBLIC_APP_URL=https://ticket-fly.vercel.app
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
TICKET_QR_SECRET=...          # ≥32 chars, NÃO reutilizar a service role
ASAAS_API_KEY=...
ASAAS_API_URL=https://api.asaas.com
ASAAS_WEBHOOK_TOKEN=...
CRON_SECRET=...
```

Se for usar Mercado Pago também:

```txt
MERCADO_PAGO_ACCESS_TOKEN=...
MERCADO_PAGO_WEBHOOK_SECRET=...
```

Conferir: `ASAAS_API_URL` em produção **não** pode ser sandbox.

### 2) Banco (SQL Editor do Supabase **do yDeddz**, projeto TicketFly)

Não usar o projeto `DIRETORIA DOS MLK`. Leonardo não tem API nesse banco — o yDeddz cola o SQL.

Obrigatórias (senão porta e o cron HTTP quebram):

- `supabase/migrations/20260804160000_expire_stale_reservations.sql` (função que o cron externo chama)
- `supabase/migrations/20260808112824_door_sales_atomic_flow.sql`

**Não** aplicar `20260808111613_schedule_expire_stale_reservations.sql` — o combinado é cron externo, não `pg_cron`.

Primeiro admin (trocar o e-mail):

```sql
update public.users
set role = 'admin'
where email = 'seu-email@dominio.com';
```

A pessoa precisa **já ter conta** em `/login` no site.

### 3) Webhooks (yDeddz no painel Asaas / MP)

Sem isso o Pix/cartão confirma no banco do provedor e o ingresso **fica pending**.

| Provedor | URL |
|---|---|
| Asaas | `https://ticket-fly.vercel.app/api/webhooks/asaas` |
| Mercado Pago | `https://ticket-fly.vercel.app/api/webhooks/mercado-pago` (tópico `payment`) |

O token/secret do webhook tem que ser o mesmo da Vercel (`ASAAS_WEBHOOK_TOKEN` / `MERCADO_PAGO_WEBHOOK_SECRET`).

### 4) Contrato da casa (Leonardo no admin)

1. Entrar em `https://ticket-fly.vercel.app/admin`
2. **Contratos**: criar ou aprovar a casa (limiar da taxa em **reais**, ex. `120,00`)
3. Se criar usuário novo, avisar o parceiro para olhar o e-mail e definir senha (`/redefinir-senha`, código de 8 dígitos)
4. Opcional: **Equipe porta** em `/admin/equipe` — só se a casa tiver operador que **não** é o organizador

Checklist do admin fica na própria `/admin`.

### 5) Casa configura venda (yDeddz ou o organizador)

1. Login → `/organizador`
2. Fechar o **checklist da casa** no dashboard
3. **Pagamentos**: conectar **Asaas** (obrigatório se for vender na porta) ou Mercado Pago
4. **Eventos**: criar evento → adicionar lote (preço em R$) → **Publicar**
5. Abrir a página pública `/eventos/[slug]` e conferir lote visível

Sem provedor conectado, a venda online cai na conta da **plataforma**, não da casa.

### 6) Homologação ponta a ponta (os dois)

Pode usar o seed (evento de teste) **ou** o evento real em rascunho.

**Seed (SQL Editor), depois de ter um organizador aprovado:**

Rodar o arquivo `supabase/seed_test_ops.sql`.

- Página: `/eventos/ops-teste-agosto`
- Cupom: `TESTE10`
- Promotor: `?ref=OPSTESTE`

**Teste obrigatório:**

1. Comprar 1 ingresso (nome + e-mail reais)
2. Pagar no Asaas/MP
3. Esperar `/status/[id]` virar aprovado (se não virar: webhook)
4. Abrir o ingresso, ver QR e código `XXXX-XXXX`
5. Em `/checkin`, selecionar o evento, escanear **e** digitar o código
6. Escanear de novo → tem que dizer **já usado**
7. Reembolsar esse ingresso teste no painel (e conferir no Asaas)

**Porta (se for usar na noite):**

1. Asaas conectado
2. `/organizador/vendas-na-entrada`
3. Gerar PIX, pagar no celular, abrir o ingresso pelo link `/pagar/...`

### 7) Ensaio de porta (27–29/08)

No celular, no local (ou simulando Wi-Fi ruim):

- [ ] 1 ingresso válido → “Ingresso válido”
- [ ] 1 já usado → “Ingresso já usado”
- [ ] Código manual `XXXX-XXXX`
- [ ] Evento errado selecionado → recusa
- [ ] Tela do ingresso atualizada se o QR “expirou” (~90s)
- [ ] Plano B: 4G se o Wi-Fi da casa cair

### 8) Go / no-go (30–31/08)

**Pode abrir venda pública só se tudo isto estiver verde:**

- [ ] `ticket-fly.vercel.app` está com **este** código (não a FAQ antiga só de Mercado Pago)
- [ ] Webhook Asaas (e MP, se usar) testado: pagamento → ingresso `paid`
- [ ] Casa com contrato **aprovado** e provedor **conectado**
- [ ] Evento **publicado** com lote ativo
- [ ] Check-in testado no celular
- [ ] `TICKET_QR_SECRET` na Vercel **não** vai ser trocado no meio das vendas
- [ ] Cron externo 10 min no host certo, com o mesmo `CRON_SECRET` da Vercel
- [ ] Auth URLs do Supabase incluem `ticket-fly.vercel.app` (ver [`AMBIENTE.md`](AMBIENTE.md))

**Não abrir se:** pagamento confirma no Asaas e o QR não libera.

---

## URLs rápidas

| O quê | URL |
|---|---|
| Site | https://ticket-fly.vercel.app |
| Eventos | /eventos |
| Login | /login |
| Admin | /admin |
| Contratos | /admin/contratos |
| Equipe porta | /admin/equipe |
| Organizador | /organizador |
| Pagamentos da casa | /organizador/pagamentos |
| Eventos da casa | /organizador/eventos |
| Porta / PIX | /organizador/vendas-na-entrada |
| Check-in | /checkin |
| Meus ingressos | /painel |

---

## Se der problema na hora

| Sintoma | O que fazer |
|---|---|
| Paguei e o ingresso não aparece | `/status/[id]` → “Já paguei”. Se continuar: webhook/token |
| QR “expirado” na fila | Atualizar a tela do ingresso (gira a cada ~90s) ou usar o código manual |
| Estoque “sumiu” sem venda | Cron externo 401/errado, ou falta a função SQL — ver [`AMBIENTE.md`](AMBIENTE.md) |
| Reembolso “parcial” | Ingresso já cancelado na TicketFly; estornar na mão no Asaas/MP |
| Operador não entra no check-in | Tem que ser `admin`, `organizer` aprovado, ou papel `checkin` em `/admin/equipe` |

Runbook técnico (env, secret, cron): [`docs/RUNBOOK.md`](RUNBOOK.md).

---

## Combinado entre os dois

1. yDeddz trava o mapa em [`AMBIENTE.md`](AMBIENTE.md) (Vercel env, Auth URLs, webhook Asaas, cron externo).
2. Leonardo libera admin + contrato no banco do yDeddz.
3. Casa conecta Asaas e publica o evento.
4. Os dois fazem **uma** compra real pequena e **um** check-in antes de anunciar.
5. Só então divulga o link da vitrine.
