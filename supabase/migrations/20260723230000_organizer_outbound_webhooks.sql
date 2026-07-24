-- Outbound webhooks: notify club owners of completed sales and event lifecycle changes.

alter table public.organizers
  add column if not exists webhook_url text,
  add column if not exists webhook_secret text,
  add column if not exists webhook_enabled boolean not null default false,
  add column if not exists webhook_events text[] not null default array[
    'sale.completed',
    'sale.refunded',
    'event.created',
    'event.updated',
    'event.published',
    'event.cancelled'
  ]::text[];

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'organizers_webhook_url_format'
  ) then
    alter table public.organizers
      add constraint organizers_webhook_url_format
      check (
        webhook_url is null
        or webhook_url ~* '^https://'
        or webhook_url ~* '^http://(localhost|127\.0\.0\.1)(:[0-9]+)?(/|$)'
      );
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'webhook_delivery_status') then
    create type public.webhook_delivery_status as enum ('pending', 'delivered', 'failed');
  end if;
end $$;

create table if not exists public.webhook_deliveries (
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

create index if not exists webhook_deliveries_pending_idx
  on public.webhook_deliveries (status, next_attempt_at)
  where status = 'pending';

create index if not exists webhook_deliveries_organizer_created_idx
  on public.webhook_deliveries (organizer_id, created_at desc);

alter table public.webhook_deliveries enable row level security;

drop policy if exists "organizers read own webhook deliveries" on public.webhook_deliveries;
create policy "organizers read own webhook deliveries"
  on public.webhook_deliveries for select
  using (public.is_approved_organizer(organizer_id) or public.is_admin());
