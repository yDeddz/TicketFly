-- Ambiente de testes operacional TicketFly
-- Pré-requisito: pelo menos um organizador com status = 'approved'.
-- Idempotente: recria o evento ops-teste-agosto, cupom TESTE10 e promotor OPSTESTE.
--
-- No SQL Editor do Supabase (projeto TicketFly), rode este arquivo inteiro.
-- Opcional: promova um admin antes:
--   update public.users set role = 'admin' where email = 'seu@email.com';

do $$
declare
  org_id uuid;
  event_id uuid;
  batch_pista uuid;
  batch_vip uuid;
  promoter_id uuid;
begin
  select id into org_id
  from public.organizers
  where status = 'approved'
  order by approved_at desc nulls last, created_at desc
  limit 1;

  if org_id is null then
    raise exception 'Nenhum organizador aprovado. Aprove um contrato em /admin/contratos e rode o seed de novo.';
  end if;

  delete from public.events where slug = 'ops-teste-agosto';

  insert into public.events (
    organizer_id,
    title,
    slug,
    description,
    venue_name,
    address,
    city,
    starts_at,
    ends_at,
    status
  )
  values (
    org_id,
    'Ops Teste · TicketFly Agosto',
    'ops-teste-agosto',
    'Evento de homologação operacional. Use para checkout, webhook, QR e check-in. Não vender ao público.',
    'Casa TicketFly',
    'Rua do Teste, 100',
    'São Paulo',
    now() + interval '14 days',
    now() + interval '14 days 6 hours',
    'published'
  )
  returning id into event_id;

  insert into public.ticket_batches (event_id, name, description, price_cents, quantity_total, is_active)
  values (event_id, 'Pista', 'Lote de teste R$ 80', 8000, 50, true)
  returning id into batch_pista;

  insert into public.ticket_batches (event_id, name, description, price_cents, quantity_total, is_active)
  values (event_id, 'VIP', 'Lote de teste R$ 160', 16000, 20, true)
  returning id into batch_vip;

  insert into public.promoters (organizer_id, name, code, commission_percent, is_active)
  values (org_id, 'Promotor Ops', 'OPSTESTE', 5, true)
  on conflict (code) do update
    set organizer_id = excluded.organizer_id,
        is_active = true,
        commission_percent = 5
  returning id into promoter_id;

  if promoter_id is null then
    select id into promoter_id from public.promoters where code = 'OPSTESTE';
  end if;

  insert into public.coupons (
    organizer_id,
    event_id,
    promoter_id,
    code,
    description,
    discount_type,
    discount_value,
    max_uses,
    is_active
  )
  values (
    org_id,
    event_id,
    promoter_id,
    'TESTE10',
    'Cupom de homologação 10%',
    'percent',
    10,
    100,
    true
  )
  on conflict (organizer_id, code) do update
    set event_id = excluded.event_id,
        promoter_id = excluded.promoter_id,
        is_active = true,
        discount_value = 10,
        max_uses = 100;

  raise notice 'Seed ok. Evento /eventos/ops-teste-agosto · cupom TESTE10 · ref=OPSTESTE · pista=% vip=%',
    batch_pista, batch_vip;
end $$;
