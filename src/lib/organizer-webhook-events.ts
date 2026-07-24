export const ORGANIZER_WEBHOOK_EVENTS = [
  "sale.completed",
  "sale.refunded",
  "event.created",
  "event.updated",
  "event.published",
  "event.cancelled",
] as const;

export type OrganizerWebhookEvent = (typeof ORGANIZER_WEBHOOK_EVENTS)[number];
