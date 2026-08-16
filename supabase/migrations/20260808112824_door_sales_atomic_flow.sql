alter table public.payments
  add column if not exists sales_channel text not null default 'online',
  add column if not exists payment_method text,
  add column if not exists created_by uuid references public.users(id) on delete set null,
  add column if not exists idempotency_key uuid;

alter table public.payments
  drop constraint if exists payments_sales_channel_check,
  add constraint payments_sales_channel_check
    check (sales_channel in ('online', 'door')),
  drop constraint if exists payments_payment_method_check,
  add constraint payments_payment_method_check
    check (payment_method is null or payment_method in ('pix', 'credit_card'));

alter table public.tickets
  add column if not exists buyer_phone text;

create unique index if not exists payments_door_idempotency_idx
  on public.payments (created_by, idempotency_key)
  where idempotency_key is not null;

create index if not exists payments_door_event_created_idx
  on public.payments (event_id, created_at desc)
  where sales_channel = 'door';

create or replace function public.create_door_sale(
  p_organizer_id uuid,
  p_batch_id uuid,
  p_buyer_name text,
  p_buyer_email text,
  p_buyer_phone text,
  p_payment_method text,
  p_created_by uuid,
  p_idempotency_key uuid
)
returns table(
  payment_id uuid,
  ticket_id uuid,
  ticket_code uuid,
  event_id uuid,
  event_title text,
  batch_name text,
  ticket_price_cents integer,
  fee_cents integer,
  platform_share_cents integer,
  partner_share_cents integer,
  amount_cents integer,
  net_amount_cents integer,
  existing boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing public.payments%rowtype;
  v_batch public.ticket_batches%rowtype;
  v_event public.events%rowtype;
  v_organizer public.organizers%rowtype;
  v_ticket_id uuid;
  v_ticket_code uuid;
  v_payment_id uuid;
  v_fee_percent numeric(5,2);
  v_fee_cents integer;
  v_platform_share_cents integer;
  v_partner_share_cents integer;
  v_amount_cents integer;
  v_net_amount_cents integer;
begin
  if p_payment_method not in ('pix', 'credit_card') then
    raise exception 'invalid_payment_method';
  end if;

  if p_idempotency_key is null then
    raise exception 'idempotency_key_required';
  end if;

  select p.*
    into v_existing
  from public.payments p
  where p.created_by = p_created_by
    and p.idempotency_key = p_idempotency_key
  limit 1;

  if found then
    if v_existing.ticket_batch_id <> p_batch_id
      or v_existing.payment_method <> p_payment_method then
      raise exception 'idempotency_conflict';
    end if;

    return query
    select
      p.id,
      t.id,
      t.code,
      p.event_id,
      e.title,
      b.name,
      b.price_cents,
      p.platform_fee_cents,
      p.platform_fee_share_cents,
      p.partner_fee_share_cents,
      p.amount_cents,
      p.net_amount_cents,
      true
    from public.payments p
    join public.tickets t on t.payment_id = p.id
    join public.events e on e.id = p.event_id
    join public.ticket_batches b on b.id = p.ticket_batch_id
    where p.id = v_existing.id;
    return;
  end if;

  select *
    into v_batch
  from public.ticket_batches
  where id = p_batch_id
  for update;

  if not found then
    raise exception 'ticket_batch_not_found';
  end if;

  select *
    into v_event
  from public.events
  where id = v_batch.event_id;

  if not found or v_event.organizer_id <> p_organizer_id then
    raise exception 'event_not_owned';
  end if;

  if v_event.status <> 'published' then
    raise exception 'event_not_published';
  end if;

  select *
    into v_organizer
  from public.organizers
  where id = p_organizer_id
    and status = 'approved';

  if not found then
    raise exception 'organizer_not_approved';
  end if;

  if not v_batch.is_active
    or now() < v_batch.sales_start_at
    or (v_batch.sales_end_at is not null and now() > v_batch.sales_end_at) then
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
  v_platform_share_cents := round(
    v_fee_cents * v_organizer.service_fee_platform_share_percent / 100.0
  );
  v_partner_share_cents := v_fee_cents - v_platform_share_cents;
  v_amount_cents := v_batch.price_cents + v_fee_cents;
  v_net_amount_cents := v_batch.price_cents + v_partner_share_cents;

  update public.ticket_batches
  set quantity_reserved = quantity_reserved + 1
  where id = v_batch.id;

  insert into public.tickets (
    event_id,
    ticket_batch_id,
    buyer_name,
    buyer_email,
    buyer_phone,
    amount_paid_cents
  )
  values (
    v_event.id,
    v_batch.id,
    trim(p_buyer_name),
    lower(trim(p_buyer_email)),
    p_buyer_phone,
    v_amount_cents
  )
  returning id, code into v_ticket_id, v_ticket_code;

  insert into public.payments (
    event_id,
    ticket_batch_id,
    amount_cents,
    platform_fee_cents,
    platform_fee_share_cents,
    partner_fee_share_cents,
    insurance_cents,
    insurance_selected,
    discount_cents,
    net_amount_cents,
    status,
    provider,
    sales_channel,
    payment_method,
    created_by,
    idempotency_key,
    raw_payload
  )
  values (
    v_event.id,
    v_batch.id,
    v_amount_cents,
    v_fee_cents,
    v_platform_share_cents,
    v_partner_share_cents,
    0,
    false,
    0,
    v_net_amount_cents,
    'pending',
    'asaas',
    'door',
    p_payment_method,
    p_created_by,
    p_idempotency_key,
    jsonb_build_object('source', 'door_sale', 'provider_state', 'not_created')
  )
  returning id into v_payment_id;

  update public.tickets
  set payment_id = v_payment_id
  where id = v_ticket_id;

  return query select
    v_payment_id,
    v_ticket_id,
    v_ticket_code,
    v_event.id,
    v_event.title,
    v_batch.name,
    v_batch.price_cents,
    v_fee_cents,
    v_platform_share_cents,
    v_partner_share_cents,
    v_amount_cents,
    v_net_amount_cents,
    false;
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
  select * into v_payment
  from public.payments
  where id = p_payment_id
  for update;

  if not found then
    raise exception 'payment_not_found';
  end if;

  -- Terminal/monotonic state machine: delayed provider events cannot regress
  -- a paid/refunded transaction or resurrect released inventory.
  if v_payment.status = 'refunded' then
    return;
  end if;

  if v_payment.status = 'approved' and p_status <> 'refunded' then
    return;
  end if;

  if v_payment.status in ('rejected', 'cancelled')
    and p_status not in ('rejected', 'cancelled', 'refunded') then
    return;
  end if;

  update public.payments
  set
    status = p_status,
    provider_payment_id = coalesce(p_provider_payment_id, provider_payment_id),
    raw_payload = p_payload,
    updated_at = now()
  where id = p_payment_id;

  select * into v_ticket
  from public.tickets
  where payment_id = p_payment_id
  for update;

  if not found then
    return;
  end if;

  if p_status = 'approved' and v_ticket.status = 'pending' then
    update public.tickets
    set
      status = 'paid',
      amount_paid_cents = v_payment.amount_cents
    where id = v_ticket.id;

    update public.ticket_batches
    set
      quantity_reserved = greatest(quantity_reserved - 1, 0),
      quantity_sold = quantity_sold + 1
    where id = v_ticket.ticket_batch_id;
  elsif p_status = 'refunded' and v_ticket.status in ('paid', 'used') then
    update public.tickets
    set
      status = 'cancelled',
      cancelled_at = coalesce(cancelled_at, now()),
      manual_code = null,
      manual_code_expires_at = null
    where id = v_ticket.id;

    perform public.rotate_ticket_qr_token(v_ticket.id);

    update public.ticket_batches
    set quantity_sold = greatest(quantity_sold - 1, 0)
    where id = v_ticket.ticket_batch_id;
  elsif p_status in ('rejected', 'cancelled', 'refunded')
    and v_ticket.status = 'pending' then
    perform public.release_reserved_ticket(v_ticket.id);
  end if;
end;
$$;

revoke all on function public.create_door_sale(
  uuid, uuid, text, text, text, text, uuid, uuid
) from public, anon, authenticated;
grant execute on function public.create_door_sale(
  uuid, uuid, text, text, text, text, uuid, uuid
) to service_role;
