create extension if not exists pgcrypto;
create extension if not exists citext;

create type public.user_role as enum ('customer', 'organizer', 'admin', 'checkin');
create type public.organizer_status as enum ('pending', 'approved', 'rejected', 'suspended');
create type public.event_status as enum ('draft', 'published', 'cancelled', 'finished');
create type public.ticket_status as enum ('pending', 'paid', 'used', 'cancelled');
create type public.payment_status as enum ('pending', 'approved', 'rejected', 'cancelled', 'refunded');
create type public.checkin_result as enum ('valid', 'already_used', 'cancelled', 'not_found', 'not_paid');
create type public.mp_connection_status as enum ('disconnected', 'connected', 'pending');
create type public.webhook_delivery_status as enum ('pending', 'delivered', 'failed');

create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email citext not null unique,
  full_name text,
  phone text,
  role public.user_role not null default 'customer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organizers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users(id) on delete cascade,
  legal_name text not null,
  trade_name text not null,
  document text not null,
  phone text,
  city text,
  status public.organizer_status not null default 'pending',
  fee_threshold_cents integer not null default 12000,
  fee_percent_upto_threshold numeric(5,2) not null default 12.00,
  fee_percent_above_threshold numeric(5,2) not null default 9.00,
  service_fee_platform_share_percent numeric(5,2) not null default 50.00,
  partnership_notes text,
  mp_collector_id text,
  mp_access_token text,
  mp_connection_status public.mp_connection_status not null default 'disconnected',
  webhook_url text,
  webhook_secret text,
  webhook_enabled boolean not null default false,
  webhook_events text[] not null default array[
    'sale.completed',
    'sale.refunded',
    'event.created',
    'event.updated',
    'event.published',
    'event.cancelled'
  ]::text[],
  approved_by uuid references public.users(id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organizers_fee_threshold_non_negative check (fee_threshold_cents >= 0),
  constraint organizers_fee_upto_range check (fee_percent_upto_threshold >= 0 and fee_percent_upto_threshold <= 40),
  constraint organizers_fee_above_range check (fee_percent_above_threshold >= 0 and fee_percent_above_threshold <= 40),
  constraint organizers_fee_share_range check (service_fee_platform_share_percent >= 0 and service_fee_platform_share_percent <= 100),
  constraint organizers_webhook_url_format check (
    webhook_url is null
    or webhook_url ~* '^https://'
    or webhook_url ~* '^http://(localhost|127\.0\.0\.1)(:[0-9]+)?(/|$)'
  )
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid not null references public.organizers(id) on delete cascade,
  title text not null,
  slug text not null unique,
  description text,
  venue_name text not null,
  address text not null,
  city text not null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  cover_image_url text,
  status public.event_status not null default 'draft',
  platform_fee_percent numeric(5,2) not null default 10.00,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint events_fee_range check (platform_fee_percent >= 0 and platform_fee_percent <= 40)
);

create table public.ticket_batches (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null,
  description text,
  price_cents integer not null,
  quantity_total integer not null,
  quantity_reserved integer not null default 0,
  quantity_sold integer not null default 0,
  sales_start_at timestamptz not null default now(),
  sales_end_at timestamptz,
  switch_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ticket_batches_price_positive check (price_cents >= 0),
  constraint ticket_batches_quantity_valid check (quantity_total >= 0 and quantity_reserved >= 0 and quantity_sold >= 0),
  constraint ticket_batches_capacity_valid check ((quantity_reserved + quantity_sold) <= quantity_total)
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete set null,
  event_id uuid not null references public.events(id) on delete restrict,
  ticket_batch_id uuid not null references public.ticket_batches(id) on delete restrict,
  amount_cents integer not null,
  platform_fee_cents integer not null default 0,
  platform_fee_share_cents integer not null default 0,
  partner_fee_share_cents integer not null default 0,
  insurance_cents integer not null default 0,
  insurance_selected boolean not null default false,
  discount_cents integer not null default 0,
  coupon_id uuid,
  net_amount_cents integer not null default 0,
  status public.payment_status not null default 'pending',
  provider text not null default 'mercado_pago',
  provider_preference_id text unique,
  provider_payment_id text unique,
  checkout_url text,
  raw_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payments_platform_fee_share_non_negative check (platform_fee_share_cents >= 0),
  constraint payments_partner_fee_share_non_negative check (partner_fee_share_cents >= 0),
  constraint payments_insurance_non_negative check (insurance_cents >= 0),
  constraint payments_discount_non_negative check (discount_cents >= 0)
);

create table public.tickets (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete restrict,
  ticket_batch_id uuid not null references public.ticket_batches(id) on delete restrict,
  payment_id uuid references public.payments(id) on delete set null,
  buyer_user_id uuid references public.users(id) on delete set null,
  buyer_name text not null,
  buyer_email citext not null,
  code uuid not null default gen_random_uuid(),
  qr_token text not null unique default encode(gen_random_bytes(32), 'hex'),
  qr_version integer not null default 1,
  qr_rotated_at timestamptz,
  manual_code text,
  manual_code_expires_at timestamptz,
  status public.ticket_status not null default 'pending',
  amount_paid_cents integer not null default 0,
  used_at timestamptz,
  cancelled_at timestamptz,
  cancelled_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tickets_code_unique unique (code),
  constraint tickets_used_at_status check ((status = 'used' and used_at is not null) or (status <> 'used'))
);

create table public.checkins (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid references public.tickets(id) on delete set null,
  event_id uuid references public.events(id) on delete set null,
  operator_id uuid references public.users(id) on delete set null,
  result public.checkin_result not null,
  message text not null,
  device_info text,
  created_at timestamptz not null default now()
);

create table public.promoters (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid not null references public.organizers(id) on delete cascade,
  name text not null,
  code text not null unique,
  commission_percent numeric(5,2) not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint promoters_commission_range check (commission_percent >= 0 and commission_percent <= 50)
);

create table public.promoter_sales (
  id uuid primary key default gen_random_uuid(),
  promoter_id uuid not null references public.promoters(id) on delete cascade,
  ticket_id uuid not null unique references public.tickets(id) on delete cascade,
  payment_id uuid references public.payments(id) on delete set null,
  commission_cents integer not null default 0,
  created_at timestamptz not null default now()
);

create type public.coupon_discount_type as enum ('percent', 'fixed');

create table public.coupons (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid not null references public.organizers(id) on delete cascade,
  event_id uuid references public.events(id) on delete cascade,
  promoter_id uuid references public.promoters(id) on delete set null,
  code text not null,
  description text,
  discount_type public.coupon_discount_type not null default 'percent',
  discount_value numeric(10,2) not null,
  max_uses integer,
  uses_count integer not null default 0,
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint coupons_code_not_blank check (length(trim(code)) >= 2),
  constraint coupons_discount_value_positive check (discount_value > 0),
  constraint coupons_percent_range check (
    discount_type <> 'percent' or (discount_value > 0 and discount_value <= 100)
  ),
  constraint coupons_fixed_cents check (
    discount_type <> 'fixed' or (discount_value = trunc(discount_value) and discount_value >= 1)
  ),
  constraint coupons_max_uses_positive check (max_uses is null or max_uses > 0),
  constraint coupons_uses_non_negative check (uses_count >= 0),
  constraint coupons_window check (ends_at is null or starts_at is null or ends_at > starts_at),
  constraint coupons_organizer_code_unique unique (organizer_id, code)
);

create table public.coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.coupons(id) on delete cascade,
  payment_id uuid not null unique references public.payments(id) on delete cascade,
  ticket_id uuid not null unique references public.tickets(id) on delete cascade,
  discount_cents integer not null default 0 check (discount_cents >= 0),
  created_at timestamptz not null default now()
);

alter table public.payments
  add constraint payments_coupon_id_fkey
  foreign key (coupon_id) references public.coupons(id) on delete set null;

create table public.webhook_deliveries (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid not null references public.organizers(id) on delete cascade,
  event_type text not null,
  idempotency_key text not null,
  payload jsonb not null,
  target_url text not null,
  status public.webhook_delivery_status not null default 'pending',
  attempts integer not null default 0,
  response_status integer,
  last_error text,
  delivered_at timestamptz,
  next_attempt_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint webhook_deliveries_idempotent unique (organizer_id, event_type, idempotency_key),
  constraint webhook_deliveries_attempts_non_negative check (attempts >= 0)
);

create index users_role_idx on public.users(role);
create index organizers_status_idx on public.organizers(status);
create index events_organizer_status_idx on public.events(organizer_id, status);
create index events_slug_idx on public.events(slug);
create index events_starts_at_idx on public.events(starts_at);
create index ticket_batches_event_active_idx on public.ticket_batches(event_id, is_active);
create index tickets_event_status_idx on public.tickets(event_id, status);
create index tickets_payment_idx on public.tickets(payment_id);
create index tickets_buyer_email_idx on public.tickets(buyer_email);
create unique index tickets_manual_code_uidx on public.tickets (manual_code) where manual_code is not null;
create index tickets_manual_code_expires_idx on public.tickets (manual_code_expires_at) where manual_code is not null;
create index payments_status_idx on public.payments(status);
create index payments_provider_payment_idx on public.payments(provider_payment_id);
create index checkins_event_created_idx on public.checkins(event_id, created_at desc);
create index promoter_sales_promoter_idx on public.promoter_sales(promoter_id);
create index coupons_organizer_idx on public.coupons(organizer_id);
create index coupons_event_idx on public.coupons(event_id);
create index coupons_promoter_idx on public.coupons(promoter_id);
create index coupon_redemptions_coupon_idx on public.coupon_redemptions(coupon_id);
create index payments_coupon_idx on public.payments(coupon_id);
create index webhook_deliveries_pending_idx on public.webhook_deliveries(status, next_attempt_at) where status = 'pending';
create index webhook_deliveries_organizer_created_idx on public.webhook_deliveries(organizer_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_users_updated_at before update on public.users for each row execute function public.set_updated_at();
create trigger set_organizers_updated_at before update on public.organizers for each row execute function public.set_updated_at();
create trigger set_events_updated_at before update on public.events for each row execute function public.set_updated_at();
create trigger set_ticket_batches_updated_at before update on public.ticket_batches for each row execute function public.set_updated_at();
create trigger set_payments_updated_at before update on public.payments for each row execute function public.set_updated_at();
create trigger set_tickets_updated_at before update on public.tickets for each row execute function public.set_updated_at();
create trigger set_promoters_updated_at before update on public.promoters for each row execute function public.set_updated_at();
create trigger set_coupons_updated_at before update on public.coupons for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select role from public.users where id = auth.uid()), 'customer'::public.user_role);
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_role() = 'admin';
$$;

create or replace function public.is_approved_organizer(p_organizer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organizers
    where id = p_organizer_id
      and user_id = auth.uid()
      and status = 'approved'
  );
$$;

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

  if p_promoter_code is not null and length(trim(p_promoter_code)) > 0 then
    select * into v_promoter
    from public.promoters
    where lower(code) = lower(trim(p_promoter_code))
      and organizer_id = v_organizer.id
      and is_active = true;
  end if;

  return query select v_ticket_id, v_ticket_code, v_qr_token, v_batch.event_id, v_batch.price_cents, v_fee_cents, v_promoter.id;
end;
$$;

create or replace function public.release_reserved_ticket(p_ticket_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ticket public.tickets%rowtype;
begin
  select * into v_ticket
  from public.tickets
  where id = p_ticket_id
  for update;

  if not found or v_ticket.status <> 'pending' then
    return;
  end if;

  update public.tickets
  set status = 'cancelled', cancelled_at = now()
  where id = v_ticket.id;

  update public.ticket_batches
  set quantity_reserved = greatest(quantity_reserved - 1, 0)
  where id = v_ticket.ticket_batch_id;
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
  elsif p_status = 'refunded' and v_ticket.status in ('paid', 'used') then
    -- Chargeback / MP refund after sale: block door entry and rotate secrets.
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
  elsif p_status in ('rejected', 'cancelled', 'refunded') and v_ticket.status = 'pending' then
    perform public.release_reserved_ticket(v_ticket.id);
  end if;
end;
$$;

create or replace function public.perform_checkin(
  p_qr_token text,
  p_operator_id uuid default auth.uid(),
  p_device_info text default null
)
returns table(result public.checkin_result, message text, ticket_id uuid, event_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ticket public.tickets%rowtype;
  v_result public.checkin_result;
  v_message text;
begin
  -- SECURITY: match ONLY qr_token. Public ticket code must never check in.
  select * into v_ticket
  from public.tickets
  where qr_token = p_qr_token
  for update;

  if not found then
    insert into public.checkins (operator_id, result, message, device_info)
    values (p_operator_id, 'not_found', 'Ingresso não encontrado', p_device_info);
    return query select 'not_found'::public.checkin_result, 'Ingresso não encontrado'::text, null::uuid, null::uuid;
    return;
  end if;

  if v_ticket.status = 'cancelled' then
    v_result := 'cancelled';
    v_message := 'Ingresso cancelado';
  elsif v_ticket.status = 'used' then
    v_result := 'already_used';
    v_message := 'Ingresso já usado';
  elsif v_ticket.status <> 'paid' then
    v_result := 'not_paid';
    v_message := 'Pagamento ainda não confirmado';
  else
    update public.tickets
    set
      status = 'used',
      used_at = now(),
      manual_code = null,
      manual_code_expires_at = null
    where id = v_ticket.id;
    v_result := 'valid';
    v_message := 'Ingresso válido';
  end if;

  if v_result in ('valid', 'already_used', 'cancelled') then
    update public.tickets
    set manual_code = null, manual_code_expires_at = null
    where id = v_ticket.id
      and (manual_code is not null or manual_code_expires_at is not null);
  end if;

  insert into public.checkins (ticket_id, event_id, operator_id, result, message, device_info)
  values (v_ticket.id, v_ticket.event_id, p_operator_id, v_result, v_message, p_device_info);

  return query select v_result, v_message, v_ticket.id, v_ticket.event_id;
end;
$$;

create or replace function public.rotate_ticket_qr_token(p_ticket_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_token text;
begin
  v_new_token := encode(gen_random_bytes(32), 'hex');

  update public.tickets
  set
    qr_token = v_new_token,
    qr_version = coalesce(qr_version, 1) + 1,
    qr_rotated_at = now(),
    manual_code = null,
    manual_code_expires_at = null
  where id = p_ticket_id;

  if not found then
    raise exception 'ticket_not_found';
  end if;

  return v_new_token;
end;
$$;

create or replace function public.claim_coupon(
  p_coupon_id uuid,
  p_organizer_id uuid,
  p_event_id uuid,
  p_ticket_price_cents integer
)
returns table(coupon_id uuid, discount_cents integer, promoter_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coupon public.coupons%rowtype;
  v_discount integer;
begin
  select * into v_coupon
  from public.coupons
  where id = p_coupon_id
  for update;

  if not found then
    raise exception 'coupon_not_found';
  end if;

  if v_coupon.organizer_id <> p_organizer_id then
    raise exception 'coupon_wrong_organizer';
  end if;

  if not v_coupon.is_active then
    raise exception 'coupon_inactive';
  end if;

  if v_coupon.event_id is not null and v_coupon.event_id <> p_event_id then
    raise exception 'coupon_wrong_event';
  end if;

  if v_coupon.starts_at is not null and now() < v_coupon.starts_at then
    raise exception 'coupon_not_started';
  end if;

  if v_coupon.ends_at is not null and now() > v_coupon.ends_at then
    raise exception 'coupon_expired';
  end if;

  if v_coupon.max_uses is not null and v_coupon.uses_count >= v_coupon.max_uses then
    raise exception 'coupon_exhausted';
  end if;

  if v_coupon.discount_type = 'percent' then
    v_discount := round(p_ticket_price_cents * v_coupon.discount_value / 100.0);
  else
    v_discount := least(p_ticket_price_cents, v_coupon.discount_value::integer);
  end if;

  if v_discount <= 0 then
    raise exception 'coupon_no_discount';
  end if;

  update public.coupons
  set uses_count = uses_count + 1
  where id = v_coupon.id;

  return query select v_coupon.id, v_discount, v_coupon.promoter_id;
end;
$$;

create or replace function public.release_coupon_claim(p_coupon_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.coupons
  set uses_count = greatest(uses_count - 1, 0)
  where id = p_coupon_id;
end;
$$;

alter table public.users enable row level security;
alter table public.organizers enable row level security;
alter table public.events enable row level security;
alter table public.ticket_batches enable row level security;
alter table public.tickets enable row level security;
alter table public.payments enable row level security;
alter table public.checkins enable row level security;
alter table public.promoters enable row level security;
alter table public.promoter_sales enable row level security;
alter table public.coupons enable row level security;
alter table public.coupon_redemptions enable row level security;
alter table public.webhook_deliveries enable row level security;

create policy "users can read own profile" on public.users for select using (id = auth.uid() or public.is_admin());
create policy "users can update own profile" on public.users for update using (id = auth.uid()) with check (id = auth.uid());
create policy "admins manage users" on public.users for all using (public.is_admin()) with check (public.is_admin());

create policy "organizers read own record" on public.organizers for select using (user_id = auth.uid() or public.is_admin());
create policy "users request organizer account" on public.organizers for insert with check (user_id = auth.uid());
create policy "organizers update own pending data" on public.organizers for update using (user_id = auth.uid() or public.is_admin()) with check (user_id = auth.uid() or public.is_admin());

create policy "published events are public" on public.events for select using (status = 'published' or public.is_approved_organizer(organizer_id) or public.is_admin());
create policy "approved organizers create events" on public.events for insert with check (public.is_approved_organizer(organizer_id) or public.is_admin());
create policy "organizers manage own events" on public.events for update using (public.is_approved_organizer(organizer_id) or public.is_admin()) with check (public.is_approved_organizer(organizer_id) or public.is_admin());

create policy "public reads active batches for published events" on public.ticket_batches for select using (
  exists (select 1 from public.events e where e.id = event_id and e.status = 'published')
  or exists (select 1 from public.events e where e.id = event_id and (public.is_approved_organizer(e.organizer_id) or public.is_admin()))
);
create policy "organizers manage batches" on public.ticket_batches for all using (
  exists (select 1 from public.events e where e.id = event_id and (public.is_approved_organizer(e.organizer_id) or public.is_admin()))
) with check (
  exists (select 1 from public.events e where e.id = event_id and (public.is_approved_organizer(e.organizer_id) or public.is_admin()))
);

create policy "buyers read own tickets" on public.tickets for select using (
  buyer_user_id = auth.uid()
  or buyer_email = (select email from public.users where id = auth.uid())
  or public.is_admin()
  or exists (select 1 from public.events e where e.id = event_id and public.is_approved_organizer(e.organizer_id))
  or public.current_user_role() = 'checkin'
);
create policy "admins update tickets" on public.tickets for update using (public.is_admin()) with check (public.is_admin());

create policy "buyers read own payments" on public.payments for select using (
  user_id = auth.uid()
  or public.is_admin()
  or exists (select 1 from public.events e where e.id = event_id and public.is_approved_organizer(e.organizer_id))
);

create policy "operators read checkins" on public.checkins for select using (
  public.current_user_role() in ('admin', 'checkin')
  or exists (select 1 from public.events e where e.id = event_id and public.is_approved_organizer(e.organizer_id))
);
create policy "operators insert checkins" on public.checkins for insert with check (public.current_user_role() in ('admin', 'checkin'));

create policy "organizers manage promoters" on public.promoters for all using (
  public.is_approved_organizer(organizer_id) or public.is_admin()
) with check (
  public.is_approved_organizer(organizer_id) or public.is_admin()
);

create policy "organizers read promoter sales" on public.promoter_sales for select using (
  public.is_admin()
  or exists (
    select 1
    from public.promoters p
    where p.id = promoter_id and public.is_approved_organizer(p.organizer_id)
  )
);

create policy "organizers manage coupons" on public.coupons for all
  using (public.is_approved_organizer(organizer_id) or public.is_admin())
  with check (public.is_approved_organizer(organizer_id) or public.is_admin());

create policy "organizers read coupon redemptions" on public.coupon_redemptions for select
  using (
    public.is_admin()
    or exists (
      select 1 from public.coupons c
      where c.id = coupon_id and public.is_approved_organizer(c.organizer_id)
    )
  );

create policy "organizers read own webhook deliveries" on public.webhook_deliveries for select using (
  public.is_approved_organizer(organizer_id) or public.is_admin()
);

revoke all on function public.reserve_ticket(uuid, text, text, uuid, text) from public, anon, authenticated;
revoke all on function public.release_reserved_ticket(uuid) from public, anon, authenticated;
revoke all on function public.apply_payment_status(uuid, public.payment_status, text, jsonb) from public, anon, authenticated;
revoke all on function public.perform_checkin(text, uuid, text) from public, anon;
revoke all on function public.perform_checkin(text, uuid, text) from authenticated;
revoke all on function public.rotate_ticket_qr_token(uuid) from public, anon, authenticated;
revoke all on function public.claim_coupon(uuid, uuid, uuid, integer) from public, anon, authenticated;
revoke all on function public.release_coupon_claim(uuid) from public, anon, authenticated;

grant execute on function public.reserve_ticket(uuid, text, text, uuid, text) to service_role;
grant execute on function public.release_reserved_ticket(uuid) to service_role;
grant execute on function public.apply_payment_status(uuid, public.payment_status, text, jsonb) to service_role;
grant execute on function public.perform_checkin(text, uuid, text) to service_role;
grant execute on function public.rotate_ticket_qr_token(uuid) to service_role;
grant execute on function public.claim_coupon(uuid, uuid, uuid, integer) to service_role;
grant execute on function public.release_coupon_claim(uuid) to service_role;
