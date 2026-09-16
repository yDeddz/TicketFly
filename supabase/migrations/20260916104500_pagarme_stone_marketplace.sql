-- Pagar.me/Stone V5: recebedor cadastrado somente pela administração TicketFly.

alter table public.organizers
  add column if not exists pagarme_recipient_id text,
  add column if not exists pagarme_connection_status public.mp_connection_status not null default 'disconnected';

alter table public.organizers
  drop constraint if exists organizers_pagarme_recipient_id_check,
  drop constraint if exists organizers_primary_payment_provider_check;

alter table public.organizers
  add constraint organizers_pagarme_recipient_id_check
    check (pagarme_recipient_id is null or pagarme_recipient_id ~ '^rp_[A-Za-z0-9]+$'),
  add constraint organizers_primary_payment_provider_check
    check (primary_payment_provider in ('mercado_pago', 'asaas', 'pagarme'));

update public.organizers
set primary_payment_provider = 'pagarme',
    fee_percent_upto_threshold = 12,
    fee_percent_above_threshold = 12,
    service_fee_platform_share_percent = 50,
    pagarme_connection_status = case
      when pagarme_recipient_id is not null then 'connected'::public.mp_connection_status
      else 'disconnected'::public.mp_connection_status
    end;

comment on column public.organizers.pagarme_recipient_id is
  'Pagar.me recipient rp_...; managed only by TicketFly administrators';

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

  if auth.uid() is null then
    return NEW;
  end if;

  if TG_OP = 'INSERT' then
    NEW.user_id := auth.uid();
    NEW.status := 'pending';
    NEW.fee_threshold_cents := 12000;
    NEW.fee_percent_upto_threshold := 12;
    NEW.fee_percent_above_threshold := 12;
    NEW.service_fee_platform_share_percent := 50;
    NEW.mp_collector_id := null;
    NEW.mp_access_token := null;
    NEW.mp_connection_status := 'disconnected';
    NEW.primary_payment_provider := 'pagarme';
    NEW.asaas_account_id := null;
    NEW.asaas_wallet_id := null;
    NEW.asaas_connection_status := 'disconnected';
    NEW.asaas_account_status := null;
    NEW.pagarme_recipient_id := null;
    NEW.pagarme_connection_status := 'disconnected';
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
  NEW.pagarme_recipient_id := OLD.pagarme_recipient_id;
  NEW.pagarme_connection_status := OLD.pagarme_connection_status;
  NEW.webhook_url := OLD.webhook_url;
  NEW.webhook_secret := OLD.webhook_secret;
  NEW.webhook_enabled := OLD.webhook_enabled;
  NEW.webhook_events := OLD.webhook_events;
  NEW.approved_by := OLD.approved_by;
  NEW.approved_at := OLD.approved_at;
  return NEW;
end;
$$;

revoke select (pagarme_recipient_id) on public.organizers from anon;
revoke select (pagarme_recipient_id) on public.organizers from authenticated;
