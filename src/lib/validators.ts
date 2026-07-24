import { z } from "zod";

export const checkoutSchema = z.object({
  batchId: z.string().uuid(),
  // Buyer identity is collected on Mercado Pago Checkout Pro.
  buyerName: z.string().trim().min(2).max(120).optional(),
  buyerEmail: z.string().trim().email().max(160).optional(),
  promoterCode: z.string().trim().max(40).optional().or(z.literal("")),
  insuranceSelected: z.boolean().optional().default(false),
});

export const checkinSchema = z.object({
  // Signed PP1./PPW1. JWTs or legacy 64-hex emergency token.
  qrToken: z.string().trim().min(8).max(2048),
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

export const adminOrganizerUpdateSchema = z.object({
  status: z.enum(["pending", "approved", "rejected", "suspended"]),
  feeThresholdCents: z.coerce.number().int().min(0).max(10_000_000),
  feePercentUptoThreshold: z.coerce.number().min(0).max(40),
  feePercentAboveThreshold: z.coerce.number().min(0).max(40),
  serviceFeePlatformSharePercent: z.coerce.number().min(0).max(100).default(50),
});

export const organizerApplySchema = z.object({
  tradeName: z.string().trim().min(2).max(120),
  legalName: z.string().trim().min(2).max(160),
  document: z.string().trim().min(11).max(32),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  city: z.string().trim().max(100).optional().or(z.literal("")),
  feeNote: z.string().trim().max(1000).optional().or(z.literal("")),
});

export const createContractSchema = z.object({
  email: z.string().trim().email(),
  tradeName: z.string().trim().min(2).max(120),
  legalName: z.string().trim().min(2).max(160),
  document: z.string().trim().min(11).max(32),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  city: z.string().trim().max(100).optional().or(z.literal("")),
  partnershipNotes: z.string().trim().max(1000).optional().or(z.literal("")),
  feeThresholdCents: z.coerce.number().int().min(0).max(10_000_000).default(12000),
  feePercentUptoThreshold: z.coerce.number().min(0).max(40).default(12),
  feePercentAboveThreshold: z.coerce.number().min(0).max(40).default(9),
  serviceFeePlatformSharePercent: z.coerce.number().min(0).max(100).default(50),
  status: z.enum(["pending", "approved", "rejected", "suspended"]).default("approved"),
});
