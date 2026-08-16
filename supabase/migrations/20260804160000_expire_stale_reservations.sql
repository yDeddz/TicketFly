-- Expire abandoned pending reservations (inventory + coupon claims).
-- Default TTL: 30 minutes.

create or replace function public.expire_stale_reservations(p_older_than_minutes integer default 30)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
  v_row record;
begin
  if p_older_than_minutes is null or p_older_than_minutes < 5 then
    raise exception 'ttl_too_short';
  end if;

  for v_row in
    select
      t.id as ticket_id,
      t.ticket_batch_id,
      t.payment_id,
      p.coupon_id
    from public.tickets t
    left join public.payments p on p.id = t.payment_id
    where t.status = 'pending'
      and t.created_at < now() - make_interval(mins => p_older_than_minutes)
    for update of t skip locked
  loop
    update public.tickets
    set
      status = 'cancelled',
      cancelled_at = now(),
      updated_at = now()
    where id = v_row.ticket_id;

    update public.ticket_batches
    set quantity_reserved = greatest(quantity_reserved - 1, 0)
    where id = v_row.ticket_batch_id;

    if v_row.coupon_id is not null then
      perform public.release_coupon_claim(v_row.coupon_id);
    end if;

    if v_row.payment_id is not null then
      update public.payments
      set status = 'cancelled'
      where id = v_row.payment_id
        and status = 'pending';
    end if;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.expire_stale_reservations(integer) from public, anon, authenticated;
grant execute on function public.expire_stale_reservations(integer) to service_role;

comment on function public.expire_stale_reservations(integer) is
  'Cancels pending tickets older than N minutes, frees batch reservation and coupon claims.';
