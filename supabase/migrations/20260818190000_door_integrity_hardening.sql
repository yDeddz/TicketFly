-- Porta + estoque + check-in: um único lugar atômico.
-- Idempotente: pode rodar mesmo se 20260808112824 já tiver sido aplicada.

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

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'ticket_batches_capacity_valid'
  ) and not exists (
    select 1
    from public.ticket_batches
    where quantity_reserved + quantity_sold > quantity_total
  ) then
    alter table public.ticket_batches
      add constraint ticket_batches_capacity_valid
      check ((quantity_reserved + quantity_sold) <= quantity_total);
  end if;
end;
$$;

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
  v_reuse_key boolean := false;
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
  for update;

  if found then
    if v_existing.status in ('cancelled', 'rejected') then
      update public.payments
      set idempotency_key = null
      where id = v_existing.id;
      v_reuse_key := true;
    else
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
    jsonb_build_object(
      'source', 'door_sale',
      'provider_state', 'not_created',
      'key_reused_after_cancel', v_reuse_key
    )
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
exception
  when unique_violation then
    select p.*
      into v_existing
    from public.payments p
    where p.created_by = p_created_by
      and p.idempotency_key = p_idempotency_key
    limit 1;

    if not found then
      raise;
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
  v_ticket_found boolean := false;
begin
  select * into v_payment
  from public.payments
  where id = p_payment_id
  for update;

  if not found then
    raise exception 'payment_not_found';
  end if;

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

  select * into v_ticket
  from public.tickets
  where payment_id = p_payment_id
  for update;
  v_ticket_found := found;

  if p_status = 'approved' and v_ticket_found and v_ticket.status = 'cancelled' then
    return;
  end if;

  update public.payments
  set
    status = p_status,
    provider_payment_id = coalesce(p_provider_payment_id, provider_payment_id),
    raw_payload = p_payload,
    updated_at = now()
  where id = p_payment_id;

  if not v_ticket_found then
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

create or replace function public.cancel_pending_door_sale(
  p_payment_id uuid,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.payments%rowtype;
  v_ticket public.tickets%rowtype;
begin
  select * into v_payment
  from public.payments
  where id = p_payment_id
  for update;

  if not found or v_payment.status <> 'pending' then
    return;
  end if;

  select * into v_ticket
  from public.tickets
  where payment_id = p_payment_id
  for update;

  if found then
    perform public.release_reserved_ticket(v_ticket.id);
  end if;

  update public.payments
  set
    status = 'cancelled',
    raw_payload = jsonb_build_object(
      'source', 'door_sale',
      'provider_state', 'rejected_before_creation',
      'reason', p_reason
    ),
    updated_at = now()
  where id = p_payment_id
    and status = 'pending';
end;
$$;

create or replace function public.cancel_ticket_restore_inventory(
  p_ticket_id uuid,
  p_actor_id uuid default null,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ticket public.tickets%rowtype;
  v_payment public.payments%rowtype;
  v_payment_id uuid;
begin
  select payment_id into v_payment_id
  from public.tickets
  where id = p_ticket_id;

  if not found then
    raise exception 'ticket_not_found';
  end if;

  if v_payment_id is not null then
    select * into v_payment
    from public.payments
    where id = v_payment_id
    for update;

    if not found then
      v_payment_id := null;
    end if;
  end if;

  select * into v_ticket
  from public.tickets
  where id = p_ticket_id
  for update;

  if not found then
    raise exception 'ticket_not_found';
  end if;

  if v_ticket.status = 'cancelled' then
    return;
  end if;

  if v_payment_id is not null then
    if v_ticket.status = 'pending' then
      perform public.apply_payment_status(
        v_payment_id,
        'cancelled',
        v_payment.provider_payment_id,
        jsonb_build_object(
          'source', 'cancel_ticket_restore_inventory',
          'actor', p_actor_id,
          'reason', p_reason
        )
      );
    else
      perform public.apply_payment_status(
        v_payment_id,
        'refunded',
        v_payment.provider_payment_id,
        jsonb_build_object(
          'source', 'cancel_ticket_restore_inventory',
          'actor', p_actor_id,
          'reason', p_reason
        )
      );
    end if;

    if p_actor_id is not null then
      update public.tickets
      set cancelled_by = p_actor_id
      where id = p_ticket_id;
    end if;
    return;
  end if;

  if v_ticket.status = 'pending' then
    perform public.release_reserved_ticket(v_ticket.id);
  elsif v_ticket.status in ('paid', 'used') then
    update public.tickets
    set
      status = 'cancelled',
      cancelled_at = coalesce(cancelled_at, now()),
      cancelled_by = coalesce(p_actor_id, cancelled_by),
      manual_code = null,
      manual_code_expires_at = null
    where id = v_ticket.id;

    perform public.rotate_ticket_qr_token(v_ticket.id);

    update public.ticket_batches
    set quantity_sold = greatest(quantity_sold - 1, 0)
    where id = v_ticket.ticket_batch_id;
  end if;
end;
$$;

create or replace function public.expire_stale_reservations(p_older_than_minutes integer default 30)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
  v_row record;
  v_payment_locked boolean;
  v_ticket_locked boolean;
begin
  if p_older_than_minutes is null or p_older_than_minutes < 5 then
    raise exception 'ttl_too_short';
  end if;

  for v_row in
    select
      t.id as ticket_id,
      t.ticket_batch_id,
      t.payment_id,
      p.coupon_id
    from public.tickets t
    left join public.payments p on p.id = t.payment_id
    where t.status = 'pending'
      and t.created_at < now() - make_interval(mins => p_older_than_minutes)
      and (p.id is null or p.status = 'pending')
    order by t.payment_id nulls first, t.id
  loop
    v_payment_locked := v_row.payment_id is null;
    v_ticket_locked := false;

    if v_row.payment_id is not null then
      perform 1
      from public.payments
      where id = v_row.payment_id
        and status = 'pending'
      for update skip locked;
      v_payment_locked := found;
    end if;

    if not v_payment_locked then
      continue;
    end if;

    perform 1
    from public.tickets
    where id = v_row.ticket_id
      and status = 'pending'
    for update skip locked;
    v_ticket_locked := found;

    if not v_ticket_locked then
      continue;
    end if;

    update public.tickets
    set
      status = 'cancelled',
      cancelled_at = now(),
      updated_at = now()
    where id = v_row.ticket_id
      and status = 'pending';

    if not found then
      continue;
    end if;

    update public.ticket_batches
    set quantity_reserved = greatest(quantity_reserved - 1, 0)
    where id = v_row.ticket_batch_id;

    if v_row.coupon_id is not null then
      perform public.release_coupon_claim(v_row.coupon_id);
    end if;

    if v_row.payment_id is not null then
      update public.payments
      set status = 'cancelled'
      where id = v_row.payment_id
        and status = 'pending';
    end if;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.create_door_sale(
  uuid, uuid, text, text, text, text, uuid, uuid
) from public, anon, authenticated;
grant execute on function public.create_door_sale(
  uuid, uuid, text, text, text, text, uuid, uuid
) to service_role;

revoke all on function public.cancel_pending_door_sale(uuid, text) from public, anon, authenticated;
grant execute on function public.cancel_pending_door_sale(uuid, text) to service_role;

revoke all on function public.cancel_ticket_restore_inventory(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.cancel_ticket_restore_inventory(uuid, uuid, text) to service_role;

revoke all on function public.expire_stale_reservations(integer) from public, anon, authenticated;
grant execute on function public.expire_stale_reservations(integer) to service_role;

revoke all on function public.apply_payment_status(
  uuid, public.payment_status, text, jsonb
) from public, anon, authenticated;
grant execute on function public.apply_payment_status(
  uuid, public.payment_status, text, jsonb
) to service_role;
