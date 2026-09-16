-- Perfil fiscal do organizador, RLS contra auto-aprovação / troca de contrato,
-- unique de documento e remoção da api key da subconta Asaas.

alter table public.organizers
  add column if not exists address text,
  add column if not exists address_number text,
  add column if not exists complement text,
  add column if not exists province text,
  add column if not exists postal_code text,
  add column if not exists birth_date date,
  add column if not exists company_type text,
  add column if not exists asaas_account_status text;

alter table public.organizers
  drop column if exists asaas_api_key;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'organizers_company_type_check'
  ) then
    alter table public.organizers
      add constraint organizers_company_type_check
      check (company_type is null or company_type in ('MEI', 'LIMITED', 'INDIVIDUAL', 'ASSOCIATION'));
  end if;
end
$$;

alter table public.organizers
  add column if not exists document_digits text
  generated always as (regexp_replace(coalesce(document, ''), '\D', '', 'g')) stored;

do $$
begin
  if not exists (
    select 1
    from public.organizers
    where length(coalesce(document_digits, '')) >= 11
    group by document_digits
    having count(*) > 1
  ) then
    create unique index if not exists organizers_document_digits_uidx
      on public.organizers (document_digits)
      where length(coalesce(document_digits, '')) >= 11;
  end if;
end
$$;

create or replace function public.organizers_sanitize_self_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() then
    return NEW;
  end if;

  -- service_role / jobs: sem JWT de usuário
  if auth.uid() is null then
    return NEW;
  end if;

  if TG_OP = 'INSERT' then
    NEW.user_id := auth.uid();
    NEW.status := 'pending';
    NEW.fee_threshold_cents := 12000;
    NEW.fee_percent_upto_threshold := 12;
    NEW.fee_percent_above_threshold := 9;
    NEW.service_fee_platform_share_percent := 50;
    NEW.mp_collector_id := null;
    NEW.mp_access_token := null;
    NEW.mp_connection_status := 'disconnected';
    NEW.primary_payment_provider := 'mercado_pago';
    NEW.asaas_account_id := null;
    NEW.asaas_wallet_id := null;
    NEW.asaas_connection_status := 'disconnected';
    NEW.asaas_account_status := null;
    NEW.webhook_url := null;
    NEW.webhook_secret := null;
    NEW.webhook_enabled := false;
    NEW.approved_by := null;
    NEW.approved_at := null;
    return NEW;
  end if;

  NEW.user_id := OLD.user_id;
  NEW.status := OLD.status;
  NEW.fee_threshold_cents := OLD.fee_threshold_cents;
  NEW.fee_percent_upto_threshold := OLD.fee_percent_upto_threshold;
  NEW.fee_percent_above_threshold := OLD.fee_percent_above_threshold;
  NEW.service_fee_platform_share_percent := OLD.service_fee_platform_share_percent;
  NEW.mp_collector_id := OLD.mp_collector_id;
  NEW.mp_access_token := OLD.mp_access_token;
  NEW.mp_connection_status := OLD.mp_connection_status;
  NEW.primary_payment_provider := OLD.primary_payment_provider;
  NEW.asaas_account_id := OLD.asaas_account_id;
  NEW.asaas_wallet_id := OLD.asaas_wallet_id;
  NEW.asaas_connection_status := OLD.asaas_connection_status;
  NEW.asaas_account_status := OLD.asaas_account_status;
  NEW.webhook_url := OLD.webhook_url;
  NEW.webhook_secret := OLD.webhook_secret;
  NEW.webhook_enabled := OLD.webhook_enabled;
  NEW.webhook_events := OLD.webhook_events;
  NEW.approved_by := OLD.approved_by;
  NEW.approved_at := OLD.approved_at;
  return NEW;
end;
$$;

drop trigger if exists organizers_sanitize_self_write on public.organizers;
create trigger organizers_sanitize_self_write
  before insert or update on public.organizers
  for each row execute function public.organizers_sanitize_self_write();

drop policy if exists "organizers update own pending data" on public.organizers;
drop policy if exists "organizers update own profile" on public.organizers;
create policy "organizers update own profile"
  on public.organizers
  for update
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

drop policy if exists "users request organizer account" on public.organizers;
create policy "users request organizer account"
  on public.organizers
  for insert
  with check (
    user_id = auth.uid()
    and status = 'pending'
  );

revoke update on public.organizers from anon;
revoke update on public.organizers from authenticated;
grant update (
  trade_name,
  legal_name,
  document,
  phone,
  city,
  partnership_notes,
  address,
  address_number,
  complement,
  province,
  postal_code,
  birth_date,
  company_type
) on public.organizers to authenticated;

revoke select (mp_access_token, webhook_secret) on public.organizers from anon;
revoke select (mp_access_token, webhook_secret) on public.organizers from authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'event-covers',
  'event-covers',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "event covers public read" on storage.objects;
create policy "event covers public read"
  on storage.objects
  for select
  using (bucket_id = 'event-covers');
