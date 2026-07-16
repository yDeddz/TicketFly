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
  platform_fee_percent: number;
  ticket_batches: TicketBatch[];
  organizers?: {
    trade_name: string;
  } | null;
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
