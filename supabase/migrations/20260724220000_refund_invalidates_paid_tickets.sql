-- Invalidate paid/used tickets when Mercado Pago reports refund/chargeback.
-- Previously apply_payment_status only released *pending* reservations on refund,
-- leaving paid tickets check-in-ready at the door.

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

revoke all on function public.apply_payment_status(uuid, public.payment_status, text, jsonb) from public, anon, authenticated;
grant execute on function public.apply_payment_status(uuid, public.payment_status, text, jsonb) to service_role;
