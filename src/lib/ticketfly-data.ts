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
    platform_fee_percent: 10,
    organizers: { trade_name: "TicketFly Live" },
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
    platform_fee_percent: 10,
    organizers: { trade_name: "Night Mode" },
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
    platform_fee_percent: 10,
    organizers: { trade_name: "Skyline Group" },
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
    platform_fee_percent: 10,
    organizers: { trade_name: "Orbit Music" },
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
