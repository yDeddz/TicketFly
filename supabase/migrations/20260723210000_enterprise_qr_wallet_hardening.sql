-- Enterprise QR / check-in hardening (Ingress/Sympla-class)
-- 1) Track QR rotation
-- 2) perform_checkin ONLY accepts qr_token (never public code)
-- 3) rotate_ticket_qr_token for cancel/refund/transfer

alter table public.tickets
  add column if not exists qr_rotated_at timestamptz,
  add column if not exists qr_version integer not null default 1;

comment on column public.tickets.qr_token is 'Server-side check-in secret. Never expose in public URLs. Rotated on cancel/refund.';
comment on column public.tickets.code is 'Public ticket identifier for URLs. Must NOT be accepted as check-in credential.';

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
    qr_rotated_at = now()
  where id = p_ticket_id;

  if not found then
    raise exception 'ticket_not_found';
  end if;

  return v_new_token;
end;
$$;

revoke all on function public.rotate_ticket_qr_token(uuid) from public, anon, authenticated;
grant execute on function public.rotate_ticket_qr_token(uuid) to service_role;

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

revoke all on function public.perform_checkin(text, uuid, text) from public, anon, authenticated;
grant execute on function public.perform_checkin(text, uuid, text) to service_role;
