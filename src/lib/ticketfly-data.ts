import type { EventWithBatches, TicketBatch } from "@/types/domain";

export type ShowcaseEvent = EventWithBatches & {
  category: "Show" | "Festival" | "VIP" | "Live";
  highlight: string;
  lineup: string[];
  capacityLabel: string;
};

const now = "2026-05-26T12:00:00-03:00";

function batch(eventId: string, id: string, name: string, price_cents: number, sold: number): TicketBatch {
  return {
    id,
    event_id: eventId,
    name,
    description: null,
    price_cents,
    quantity_total: 800,
    quantity_reserved: 18,
    quantity_sold: sold,
    sales_start_at: now,
    sales_end_at: null,
    switch_at: null,
    is_active: true,
  };
}

export const showcaseEvents: ShowcaseEvent[] = [
  {
    id: "demo-neon-pulse",
    title: "Neon Pulse Festival",
    slug: "neon-pulse-festival",
    description:
      "Uma noite de luz, som imersivo e experiencias premium com palcos simultaneos, lounges exclusivos e acesso mobile em segundos.",
    venue_name: "Distrito Tech Arena",
    address: "Av. das Nacoes, 1200 - Sao Paulo, SP",
    city: "Sao Paulo",
    starts_at: "2026-06-20T22:00:00-03:00",
    ends_at: "2026-06-21T06:00:00-03:00",
    cover_image_url:
      "https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?auto=format&fit=crop&w=1800&q=85",
    status: "published",
    organizers: {
      trade_name: "TicketFly Live",
      fee_threshold_cents: 12000,
      fee_percent_upto_threshold: 12,
      fee_percent_above_threshold: 9,
      service_fee_platform_share_percent: 50,
      mp_connection_status: "disconnected",
    },
    category: "Festival",
    highlight: "Ao vivo",
    lineup: ["Aurora Bass", "Maya Volt", "DJ Prisma"],
    capacityLabel: "92% vendido",
    ticket_batches: [
      batch("demo-neon-pulse", "demo-neon-pulse-pista", "Pista Premium", 14900, 612),
      batch("demo-neon-pulse", "demo-neon-pulse-vip", "VIP Skyline", 32900, 244),
    ],
  },
  {
    id: "demo-after-dark",
    title: "After Dark Sessions",
    slug: "after-dark-sessions",
    description:
      "Show intimista com curadoria eletronica, bar premium, entrada expressa e areas reservadas para convidados.",
    venue_name: "Black Room Club",
    address: "Rua Augusta, 900 - Sao Paulo, SP",
    city: "Sao Paulo",
    starts_at: "2026-07-04T23:30:00-03:00",
    ends_at: "2026-07-05T05:30:00-03:00",
    cover_image_url:
      "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=1800&q=85",
    status: "published",
    organizers: {
      trade_name: "Night Mode",
      fee_threshold_cents: 12000,
      fee_percent_upto_threshold: 12,
      fee_percent_above_threshold: 9,
      service_fee_platform_share_percent: 50,
      mp_connection_status: "disconnected",
    },
    category: "Show",
    highlight: "Hot",
    lineup: ["Nina Wave", "Club Zero"],
    capacityLabel: "Ultimos lotes",
    ticket_batches: [
      batch("demo-after-dark", "demo-after-dark-pista", "Entrada", 8900, 510),
      batch("demo-after-dark", "demo-after-dark-backstage", "Backstage", 21900, 118),
    ],
  },
  {
    id: "demo-vip-skyline",
    title: "VIP Skyline Experience",
    slug: "vip-skyline-experience",
    description:
      "Open view, lista seleta e experiencia de alto padrao com check-in prioritario, mesa concierge e beneficios exclusivos.",
    venue_name: "Helix Rooftop",
    address: "Alameda Santos, 2400 - Sao Paulo, SP",
    city: "Sao Paulo",
    starts_at: "2026-07-18T21:00:00-03:00",
    ends_at: "2026-07-19T03:00:00-03:00",
    cover_image_url:
      "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1800&q=85",
    status: "published",
    organizers: {
      trade_name: "Skyline Group",
      fee_threshold_cents: 12000,
      fee_percent_upto_threshold: 12,
      fee_percent_above_threshold: 9,
      service_fee_platform_share_percent: 50,
      mp_connection_status: "disconnected",
    },
    category: "VIP",
    highlight: "VIP",
    lineup: ["Luna Chrome", "House District"],
    capacityLabel: "Acesso limitado",
    ticket_batches: [
      batch("demo-vip-skyline", "demo-vip-skyline-access", "VIP Access", 39900, 188),
      batch("demo-vip-skyline", "demo-vip-skyline-table", "Mesa Diamond", 129900, 34),
    ],
  },
  {
    id: "demo-orbit-live",
    title: "Orbit Live Tour",
    slug: "orbit-live-tour",
    description:
      "Turne audiovisual com palco 360, pulseiras luminosas sincronizadas e venda digital com ingresso inteligente.",
    venue_name: "Nova Hall",
    address: "Av. Atlantica, 1700 - Rio de Janeiro, RJ",
    city: "Rio de Janeiro",
    starts_at: "2026-08-01T20:00:00-03:00",
    ends_at: "2026-08-01T23:50:00-03:00",
    cover_image_url:
      "https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?auto=format&fit=crop&w=1800&q=85",
    status: "published",
    organizers: {
      trade_name: "Orbit Music",
      fee_threshold_cents: 12000,
      fee_percent_upto_threshold: 12,
      fee_percent_above_threshold: 9,
      service_fee_platform_share_percent: 50,
      mp_connection_status: "disconnected",
    },
    category: "Live",
    highlight: "Tour",
    lineup: ["The Orbitals", "VJ North"],
    capacityLabel: "78% vendido",
    ticket_batches: [
      batch("demo-orbit-live", "demo-orbit-live-arena", "Arena", 17900, 430),
      batch("demo-orbit-live", "demo-orbit-live-golden", "Golden Circle", 28900, 205),
    ],
  },
];

export function getShowcaseEvent(slug: string) {
  return showcaseEvents.find((event) => event.slug === slug);
}

/* -------------------------------------------------------------------------- */
/* Wallet ("Meus Ingressos") demo data                                        */
/* -------------------------------------------------------------------------- */

export type TicketTier = "VIP" | "Pista" | "Camarote";

export type WalletTicket = {
  id: string;
  code: string;
  slug: string;
  title: string;
  cover_image_url: string;
  starts_at: string;
  city: string;
  venue_name: string;
  tier: TicketTier;
  price_cents: number;
  qrReady: boolean;
  accessToken?: string;
  status?: "pending" | "paid" | "used" | "cancelled";
};

export const walletUser = {
  firstName: "Leonardo",
  isVip: true,
} as const;

export const myTickets: WalletTicket[] = [
  {
    id: "tkt-neon-pulse",
    code: "TF-8F2A-NEON",
    slug: "neon-pulse-festival",
    title: "Neon Pulse Festival",
    cover_image_url:
      "https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?auto=format&fit=crop&w=1200&q=85",
    starts_at: "2026-06-20T22:00:00-03:00",
    city: "Sao Paulo",
    venue_name: "Distrito Tech Arena",
    tier: "VIP",
    price_cents: 32900,
    qrReady: true,
  },
  {
    id: "tkt-after-dark",
    code: "TF-3C7B-DARK",
    slug: "after-dark-sessions",
    title: "After Dark Sessions",
    cover_image_url:
      "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=1200&q=85",
    starts_at: "2026-07-04T23:30:00-03:00",
    city: "Sao Paulo",
    venue_name: "Black Room Club",
    tier: "Pista",
    price_cents: 8900,
    qrReady: true,
  },
  {
    id: "tkt-vip-skyline",
    code: "TF-9D1E-SKY",
    slug: "vip-skyline-experience",
    title: "VIP Skyline Experience",
    cover_image_url:
      "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1200&q=85",
    starts_at: "2026-07-18T21:00:00-03:00",
    city: "Sao Paulo",
    venue_name: "Helix Rooftop",
    tier: "Camarote",
    price_cents: 39900,
    qrReady: true,
  },
];

export type PurchaseRecord = {
  id: string;
  title: string;
  date: string;
  amount_cents: number;
  status: "Concluido" | "Utilizado" | "Reembolsado";
};

export const purchaseHistory: PurchaseRecord[] = [
  {
    id: "ph-orbit",
    title: "Orbit Live Tour",
    date: "2026-03-02T20:00:00-03:00",
    amount_cents: 17900,
    status: "Utilizado",
  },
  {
    id: "ph-pulse-2025",
    title: "Neon Pulse Festival 2025",
    date: "2025-11-14T22:00:00-03:00",
    amount_cents: 28900,
    status: "Utilizado",
  },
  {
    id: "ph-after",
    title: "After Dark Sessions",
    date: "2026-01-25T23:30:00-03:00",
    amount_cents: 8900,
    status: "Concluido",
  },
];

export type PaymentMethod = {
  id: string;
  label: string;
  detail: string;
  primary?: boolean;
};

export const paymentMethods: PaymentMethod[] = [
  { id: "pm-visa", label: "Visa • final 2026", detail: "Expira 09/29", primary: true },
  { id: "pm-pix", label: "Pix", detail: "Aprovacao instantanea" },
];
