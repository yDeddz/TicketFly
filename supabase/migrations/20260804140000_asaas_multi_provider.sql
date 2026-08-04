-- Multi-provider receiving: Asaas columns + primary provider selection

alter table public.organizers
  add column if not exists primary_payment_provider text not null default 'mercado_pago',
  add column if not exists asaas_account_id text,
  add column if not exists asaas_wallet_id text,
  add column if not exists asaas_api_key text,
  add column if not exists asaas_connection_status public.mp_connection_status not null default 'disconnected';

alter table public.organizers
  drop constraint if exists organizers_primary_payment_provider_check;

alter table public.organizers
  add constraint organizers_primary_payment_provider_check
  check (primary_payment_provider in ('mercado_pago', 'asaas'));

comment on column public.organizers.primary_payment_provider is
  'Active checkout provider for this organizer (mercado_pago | asaas)';
comment on column public.organizers.asaas_wallet_id is
  'Asaas walletId used for marketplace split on platform charges';
comment on column public.organizers.asaas_api_key is
  'Subaccount API key returned once at creation — store securely';
