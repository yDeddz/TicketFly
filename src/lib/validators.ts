import { z } from "zod";

export const checkoutSchema = z.object({
  batchId: z.string().uuid(),
  buyerName: z.string().trim().min(2).max(120),
  buyerEmail: z.string().trim().email().max(160),
  promoterCode: z.string().trim().max(40).optional().or(z.literal("")),
});

export const checkinSchema = z.object({
  qrToken: z.string().trim().min(8).max(160),
  deviceInfo: z.string().trim().max(240).optional(),
});

export const eventSchema = z.object({
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().max(3000).optional(),
  venueName: z.string().trim().min(2).max(140),
  address: z.string().trim().min(5).max(240),
  city: z.string().trim().min(2).max(100),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime().optional().or(z.literal("")),
  coverImageUrl: z.string().url().optional().or(z.literal("")),
});

export const adminEventUpdateSchema = eventSchema
  .extend({
    status: z.enum(["draft", "published", "cancelled", "finished"]),
  })
  .refine(
    (event) => !event.endsAt || new Date(event.endsAt).getTime() > new Date(event.startsAt).getTime(),
    {
      message: "A data de termino precisa ser posterior ao inicio",
      path: ["endsAt"],
    },
  );

export const batchSchema = z.object({
  eventId: z.string().uuid(),
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(500).optional(),
  priceCents: z.coerce.number().int().min(0),
  quantityTotal: z.coerce.number().int().min(1).max(100000),
  salesEndAt: z.string().datetime().optional().or(z.literal("")),
  switchAt: z.string().datetime().optional().or(z.literal("")),
});
