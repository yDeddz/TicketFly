-- Configurable platform/partner service-fee split + purchase insurance ledger

alter table public.organizers
  add column if not exists service_fee_platform_share_percent numeric(5,2) not null default 50.00;

do $$ begin
  alter table public.organizers
    add constraint organizers_fee_share_range
    check (service_fee_platform_share_percent >= 0 and service_fee_platform_share_percent <= 100);
exception
  when duplicate_object then null;
end $$;

alter table public.payments
  add column if not exists platform_fee_share_cents integer not null default 0,
  add column if not exists partner_fee_share_cents integer not null default 0,
  add column if not exists insurance_cents integer not null default 0,
  add column if not exists insurance_selected boolean not null default false;

do $$ begin
  alter table public.payments
    add constraint payments_platform_fee_share_non_negative check (platform_fee_share_cents >= 0);
exception
  when duplicate_object then null;
end $$;

do $$ begin
  alter table public.payments
    add constraint payments_partner_fee_share_non_negative check (partner_fee_share_cents >= 0);
exception
  when duplicate_object then null;
end $$;

do $$ begin
  alter table public.payments
    add constraint payments_insurance_non_negative check (insurance_cents >= 0);
exception
  when duplicate_object then null;
end $$;

-- Backfill existing rows: full service fee was platform-owned; partner share 0
update public.payments
set
  platform_fee_share_cents = platform_fee_cents,
  partner_fee_share_cents = 0
where platform_fee_share_cents = 0
  and partner_fee_share_cents = 0
  and platform_fee_cents > 0;
