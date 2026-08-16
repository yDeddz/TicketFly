-- OPCIONAL / NÃO aplicar em produção TicketFly.
-- O combinado é cron HTTP externo (Hobby da Vercel não agenda */10).
-- Ver docs/AMBIENTE.md. Aplicar isto duplica o expire_stale_reservations.

create extension if not exists pg_cron with schema pg_catalog;

grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;

do $$
declare
  v_job_id bigint;
begin
  select jobid
    into v_job_id
  from cron.job
  where jobname = 'expire-stale-reservations'
  limit 1;

  if v_job_id is not null then
    perform cron.unschedule(v_job_id);
  end if;
end;
$$;

select cron.schedule(
  'expire-stale-reservations',
  '*/10 * * * *',
  $job$select public.expire_stale_reservations(30);$job$
);
