create extension if not exists pgcrypto;
create extension if not exists citext;

create type public.user_role as enum ('customer', 'organizer', 'admin', 'checkin');
create type public.organizer_status as enum ('pending', 'approved', 'rejected', 'suspended');
create type public.event_status as enum ('draft', 'published', 'cancelled', 'finished');
create type public.ticket_status as enum ('pending', 'paid', 'used', 'cancelled');
create type public.payment_status as enum ('pending', 'approved', 'rejected', 'cancelled', 'refunded');
create type public.checkin_result as enum ('valid', 'already_used', 'cancelled', 'not_found', 'not_paid');

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
  approved_by uuid references public.users(id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
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
  net_amount_cents integer not null default 0,
  status public.payment_status not null default 'pending',
  provider text not null default 'mercado_pago',
  provider_preference_id text unique,
  provider_payment_id text unique,
  checkout_url text,
  raw_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
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

create index users_role_idx on public.users(role);
create index organizers_status_idx on public.organizers(status);
create index events_organizer_status_idx on public.events(organizer_id, status);
create index events_slug_idx on public.events(slug);
create index events_starts_at_idx on public.events(starts_at);
create index ticket_batches_event_active_idx on public.ticket_batches(event_id, is_active);
create index tickets_event_status_idx on public.tickets(event_id, status);
create index tickets_payment_idx on public.tickets(payment_id);
create index tickets_buyer_email_idx on public.tickets(buyer_email);
create index payments_status_idx on public.payments(status);
create index payments_provider_payment_idx on public.payments(provider_payment_id);
create index checkins_event_created_idx on public.checkins(event_id, created_at desc);
create index promoter_sales_promoter_idx on public.promoter_sales(promoter_id);

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
  v_promoter public.promoters%rowtype;
  v_ticket_id uuid;
  v_ticket_code uuid;
  v_qr_token text;
  v_fee_cents integer;
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

  if not v_batch.is_active or now() < v_batch.sales_start_at or (v_batch.sales_end_at is not null and now() > v_batch.sales_end_at) then
    raise exception 'ticket_batch_closed';
  end if;

  if (v_batch.quantity_reserved + v_batch.quantity_sold) >= v_batch.quantity_total then
    raise exception 'ticket_batch_sold_out';
  end if;

  update public.ticket_batches
  set quantity_reserved = quantity_reserved + 1
  where id = v_batch.id;

  insert into public.tickets (event_id, ticket_batch_id, buyer_user_id, buyer_name, buyer_email, amount_paid_cents)
  values (v_batch.event_id, v_batch.id, p_buyer_user_id, p_buyer_name, p_buyer_email, v_batch.price_cents)
  returning id, code, qr_token into v_ticket_id, v_ticket_code, v_qr_token;

  if p_promoter_code is not null then
    select * into v_promoter
    from public.promoters
    where lower(code) = lower(p_promoter_code)
      and is_active = true;
  end if;

  v_fee_cents := round(v_batch.price_cents * v_event.platform_fee_percent / 100.0);

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
    update public.tickets set status = 'paid' where id = v_ticket.id;
    update public.ticket_batches
    set quantity_reserved = greatest(quantity_reserved - 1, 0),
        quantity_sold = quantity_sold + 1
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
  select * into v_ticket
  from public.tickets
  where qr_token = p_qr_token or code::text = p_qr_token
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
    set status = 'used', used_at = now()
    where id = v_ticket.id;
    v_result := 'valid';
    v_message := 'Ingresso válido';
  end if;

  insert into public.checkins (ticket_id, event_id, operator_id, result, message, device_info)
  values (v_ticket.id, v_ticket.event_id, p_operator_id, v_result, v_message, p_device_info);

  return query select v_result, v_message, v_ticket.id, v_ticket.event_id;
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

revoke all on function public.reserve_ticket(uuid, text, text, uuid, text) from public, anon, authenticated;
revoke all on function public.release_reserved_ticket(uuid) from public, anon, authenticated;
revoke all on function public.apply_payment_status(uuid, public.payment_status, text, jsonb) from public, anon, authenticated;
revoke all on function public.perform_checkin(text, uuid, text) from public, anon;
revoke all on function public.perform_checkin(text, uuid, text) from authenticated;

grant execute on function public.reserve_ticket(uuid, text, text, uuid, text) to service_role;
grant execute on function public.release_reserved_ticket(uuid) to service_role;
grant execute on function public.apply_payment_status(uuid, public.payment_status, text, jsonb) to service_role;
grant execute on function public.perform_checkin(text, uuid, text) to service_role;
