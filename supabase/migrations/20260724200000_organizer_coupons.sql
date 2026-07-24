-- Discount coupons for partner organizations (+ optional event/promoter scope)

do $$ begin
  if not exists (select 1 from pg_type where typname = 'coupon_discount_type') then
    create type public.coupon_discount_type as enum ('percent', 'fixed');
  end if;
end $$;

create table if not exists public.coupons (
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

create table if not exists public.coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.coupons(id) on delete cascade,
  payment_id uuid not null unique references public.payments(id) on delete cascade,
  ticket_id uuid not null unique references public.tickets(id) on delete cascade,
  discount_cents integer not null default 0 check (discount_cents >= 0),
  created_at timestamptz not null default now()
);

alter table public.payments
  add column if not exists coupon_id uuid references public.coupons(id) on delete set null,
  add column if not exists discount_cents integer not null default 0;

do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'payments_discount_non_negative'
  ) then
    alter table public.payments
      add constraint payments_discount_non_negative check (discount_cents >= 0);
  end if;
end $$;

create index if not exists coupons_organizer_idx on public.coupons(organizer_id);
create index if not exists coupons_event_idx on public.coupons(event_id);
create index if not exists coupons_promoter_idx on public.coupons(promoter_id);
create index if not exists coupons_code_lower_idx on public.coupons(organizer_id, lower(code));
create index if not exists coupon_redemptions_coupon_idx on public.coupon_redemptions(coupon_id);
create index if not exists payments_coupon_idx on public.payments(coupon_id);

drop trigger if exists set_coupons_updated_at on public.coupons;
create trigger set_coupons_updated_at
  before update on public.coupons
  for each row execute function public.set_updated_at();

-- Ensure promoter codes are scoped to the event's organizer on reserve
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

alter table public.coupons enable row level security;
alter table public.coupon_redemptions enable row level security;

drop policy if exists "organizers manage coupons" on public.coupons;
create policy "organizers manage coupons" on public.coupons for all
  using (public.is_approved_organizer(organizer_id) or public.is_admin())
  with check (public.is_approved_organizer(organizer_id) or public.is_admin());

drop policy if exists "organizers read coupon redemptions" on public.coupon_redemptions;
create policy "organizers read coupon redemptions" on public.coupon_redemptions for select
  using (
    public.is_admin()
    or exists (
      select 1 from public.coupons c
      where c.id = coupon_id and public.is_approved_organizer(c.organizer_id)
    )
  );

grant select, insert, update, delete on public.coupons to authenticated;
grant select on public.coupon_redemptions to authenticated;

revoke all on function public.claim_coupon(uuid, uuid, uuid, integer) from public, anon, authenticated;
revoke all on function public.release_coupon_claim(uuid) from public, anon, authenticated;
grant execute on function public.claim_coupon(uuid, uuid, uuid, integer) to service_role;
grant execute on function public.release_coupon_claim(uuid) to service_role;
