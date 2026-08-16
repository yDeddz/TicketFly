export type MpConnectionStatus = "disconnected" | "connected" | "pending";

export type OrganizerWebhookEvent =
  | "sale.completed"
  | "sale.refunded"
  | "event.created"
  | "event.updated"
  | "event.published"
  | "event.cancelled";

export type OrganizerSummary = {
  trade_name: string;
  fee_threshold_cents?: number;
  fee_percent_upto_threshold?: number;
  fee_percent_above_threshold?: number;
  service_fee_platform_share_percent?: number;
  mp_connection_status?: MpConnectionStatus;
  asaas_connection_status?: MpConnectionStatus;
  asaas_wallet_id?: string | null;
  primary_payment_provider?: string | null;
  webhook_enabled?: boolean;
};

export type EventWithBatches = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  venue_name: string;
  address: string;
  city: string;
  starts_at: string;
  ends_at: string | null;
  cover_image_url: string | null;
  status: "draft" | "published" | "cancelled" | "finished";
  /** @deprecated Fee comes from organizer contract; kept for legacy rows. */
  platform_fee_percent?: number;
  ticket_batches: TicketBatch[];
  organizers?: OrganizerSummary | null;
};

export type TicketBatch = {
  id: string;
  event_id: string;
  name: string;
  description: string | null;
  price_cents: number;
  quantity_total: number;
  quantity_reserved: number;
  quantity_sold: number;
  sales_start_at: string;
  sales_end_at: string | null;
  switch_at: string | null;
  is_active: boolean;
};

export type TicketStatus = "pending" | "paid" | "used" | "cancelled";
export type PaymentStatus = "pending" | "approved" | "rejected" | "cancelled" | "refunded";
