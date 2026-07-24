-- Additive service fee contracts per organizer + Mercado Pago connection prep

do $$ begin
  create type public.mp_connection_status as enum ('disconnected', 'connected', 'pending');
exception
  when duplicate_object then null;
end $$;

alter table public.organizers
  add column if not exists fee_threshold_cents integer not null default 12000,
  add column if not exists fee_percent_upto_threshold numeric(5,2) not null default 12.00,
  add column if not exists fee_percent_above_threshold numeric(5,2) not null default 9.00,
  add column if not exists mp_collector_id text,
  add column if not exists mp_access_token text,
  add column if not exists mp_connection_status public.mp_connection_status not null default 'disconnected';

do $$ begin
  alter table public.organizers
    add constraint organizers_fee_threshold_non_negative check (fee_threshold_cents >= 0);
exception
  when duplicate_object then null;
end $$;

do $$ begin
  alter table public.organizers
    add constraint organizers_fee_upto_range check (fee_percent_upto_threshold >= 0 and fee_percent_upto_threshold <= 40);
exception
  when duplicate_object then null;
end $$;

do $$ begin
  alter table public.organizers
    add constraint organizers_fee_above_range check (fee_percent_above_threshold >= 0 and fee_percent_above_threshold <= 40);
exception
  when duplicate_object then null;
end $$;

create or replace function public.reserve_ticket(
  p_batch_id uuid,
  p_buyer_name text,
  p_buyer_email text,
  p_buyer_user_id uuid default null,
  p_promoter_code text default null
)
returns table(ticket_id uuid, ticket_code uuid, qr_token text, event_id uuid, price_cents integer, fee_cents integer, promoter_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_batch public.ticket_batches%rowtype;
  v_event public.events%rowtype;
  v_organizer public.organizers%rowtype;
  v_promoter public.promoters%rowtype;
  v_ticket_id uuid;
  v_ticket_code uuid;
  v_qr_token text;
  v_fee_percent numeric(5,2);
  v_fee_cents integer;
  v_total_cents integer;
begin
  select * into v_batch
  from public.ticket_batches
  where id = p_batch_id
  for update;

  if not found then
    raise exception 'ticket_batch_not_found';
  end if;

  select * into v_event
  from public.events
  where id = v_batch.event_id;

  if v_event.status <> 'published' then
    raise exception 'event_not_published';
  end if;

  select * into v_organizer
  from public.organizers
  where id = v_event.organizer_id;

  if not found then
    raise exception 'organizer_not_found';
  end if;

  if not v_batch.is_active or now() < v_batch.sales_start_at or (v_batch.sales_end_at is not null and now() > v_batch.sales_end_at) then
    raise exception 'ticket_batch_closed';
  end if;

  if (v_batch.quantity_reserved + v_batch.quantity_sold) >= v_batch.quantity_total then
    raise exception 'ticket_batch_sold_out';
  end if;

  if v_batch.price_cents <= v_organizer.fee_threshold_cents then
    v_fee_percent := v_organizer.fee_percent_upto_threshold;
  else
    v_fee_percent := v_organizer.fee_percent_above_threshold;
  end if;

  v_fee_cents := round(v_batch.price_cents * v_fee_percent / 100.0);
  v_total_cents := v_batch.price_cents + v_fee_cents;

  update public.ticket_batches
  set quantity_reserved = quantity_reserved + 1
  where id = v_batch.id;

  insert into public.tickets (event_id, ticket_batch_id, buyer_user_id, buyer_name, buyer_email, amount_paid_cents)
  values (v_batch.event_id, v_batch.id, p_buyer_user_id, p_buyer_name, p_buyer_email, v_total_cents)
  returning id, code, qr_token into v_ticket_id, v_ticket_code, v_qr_token;

  if p_promoter_code is not null then
    select * into v_promoter
    from public.promoters
    where lower(code) = lower(p_promoter_code)
      and is_active = true;
  end if;

  return query select v_ticket_id, v_ticket_code, v_qr_token, v_batch.event_id, v_batch.price_cents, v_fee_cents, v_promoter.id;
end;
$$;

create or replace function public.apply_payment_status(
  p_payment_id uuid,
  p_status public.payment_status,
  p_provider_payment_id text,
  p_payload jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ticket public.tickets%rowtype;
  v_payment public.payments%rowtype;
begin
  select * into v_payment from public.payments where id = p_payment_id for update;
  if not found then
    raise exception 'payment_not_found';
  end if;

  update public.payments
  set status = p_status,
      provider_payment_id = coalesce(p_provider_payment_id, provider_payment_id),
      raw_payload = p_payload
  where id = p_payment_id;

  select * into v_ticket from public.tickets where payment_id = p_payment_id for update;
  if not found then
    return;
  end if;

  if p_status = 'approved' and v_ticket.status = 'pending' then
    update public.tickets
    set status = 'paid',
        amount_paid_cents = v_payment.amount_cents
    where id = v_ticket.id;
    update public.ticket_batches
    set quantity_reserved = greatest(quantity_reserved - 1, 0),
        quantity_sold = quantity_sold + 1
    where id = v_ticket.ticket_batch_id;
  elsif p_status in ('rejected', 'cancelled', 'refunded') and v_ticket.status = 'pending' then
    perform public.release_reserved_ticket(v_ticket.id);
  end if;
end;
$$;
