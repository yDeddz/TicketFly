-- Profile columns from 20260818210000 never landed in production.
-- Keep this idempotent: do not replace organizers_sanitize_self_write (Pagar.me version is current).

alter table public.organizers
  add column if not exists address text,
  add column if not exists address_number text,
  add column if not exists complement text,
  add column if not exists province text,
  add column if not exists postal_code text,
  add column if not exists birth_date date,
  add column if not exists company_type text,
  add column if not exists asaas_account_status text;

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

notify pgrst, 'reload schema';
