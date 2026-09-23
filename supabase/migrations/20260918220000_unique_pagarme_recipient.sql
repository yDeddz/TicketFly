-- One Stone/Pagar.me recipient per organizer. Linking is admin-only.

create unique index if not exists organizers_pagarme_recipient_id_uidx
  on public.organizers (pagarme_recipient_id)
  where pagarme_recipient_id is not null;

comment on column public.organizers.pagarme_recipient_id is
  'Stone/Pagar.me recipient rp_...; 1:1 with organizer; managed only by TicketFly administrators';
