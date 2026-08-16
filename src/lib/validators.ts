import { z } from "zod";

export function normalizeCpf(value: string) {
  return value.replace(/\D/g, "");
}

export function isValidCpf(value: string) {
  const cpf = normalizeCpf(value);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;

  const digit = (length: number) => {
    let sum = 0;
    for (let index = 0; index < length; index += 1) {
      sum += Number(cpf[index]) * (length + 1 - index);
    }
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };

  return digit(9) === Number(cpf[9]) && digit(10) === Number(cpf[10]);
}

export function normalizeBrazilianPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.startsWith("55") && digits.length >= 12) return digits.slice(2);
  return digits;
}

const cpfSchema = z
  .string()
  .trim()
  .transform(normalizeCpf)
  .refine(isValidCpf, "CPF inválido");

const brazilianPhoneSchema = z
  .string()
  .trim()
  .transform(normalizeBrazilianPhone)
  .refine((phone) => phone.length === 10 || phone.length === 11, "Celular inválido");

export const doorSaleSchema = z.object({
  eventId: z.string().uuid(),
  batchId: z.string().uuid(),
  buyerName: z.string().trim().min(2, "Informe o nome completo").max(120),
  buyerEmail: z.string().trim().toLowerCase().email("E-mail inválido").max(160),
  buyerCpf: cpfSchema,
  buyerPhone: brazilianPhoneSchema,
  paymentMethod: z.enum(["pix", "credit_card"]),
  idempotencyKey: z.string().uuid(),
});

export const checkoutSchema = z.object({
  batchId: z.string().uuid(),
  buyerName: z.string().trim().min(2, "Informe o nome completo").max(120),
  buyerEmail: z
    .string()
    .trim()
    .toLowerCase()
    .email("E-mail inválido")
    .max(160)
    .refine((email) => !email.endsWith("@checkout.ticketfly.app"), "Informe um e-mail real"),
  promoterCode: z.string().trim().max(40).optional().or(z.literal("")),
  couponCode: z.string().trim().max(40).optional().or(z.literal("")),
  insuranceSelected: z.boolean().optional().default(false),
});

export const promoterSchema = z.object({
  name: z.string().trim().min(2).max(120),
  code: z
    .string()
    .trim()
    .min(2)
    .max(40)
    .regex(/^[a-zA-Z0-9_-]+$/, "Use apenas letras, números, _ ou -"),
  commissionPercent: z.coerce.number().min(0).max(50).default(5),
  isActive: z.boolean().optional().default(true),
});

export const promoterUpdateSchema = promoterSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export const couponSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(2)
      .max(40)
      .regex(/^[a-zA-Z0-9_-]+$/, "Use apenas letras, números, _ ou -"),
    description: z.string().trim().max(240).optional().or(z.literal("")),
    discountType: z.enum(["percent", "fixed"]),
    discountValue: z.coerce.number().positive(),
    eventId: z.string().uuid().optional().nullable().or(z.literal("")),
    promoterId: z.string().uuid().optional().nullable().or(z.literal("")),
    maxUses: z.coerce.number().int().positive().optional().nullable().or(z.literal("")),
    startsAt: z.string().datetime().optional().or(z.literal("")),
    endsAt: z.string().datetime().optional().or(z.literal("")),
    isActive: z.boolean().optional().default(true),
  })
  .superRefine((data, ctx) => {
    if (data.discountType === "percent" && data.discountValue > 100) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Desconto percentual máximo é 100%",
        path: ["discountValue"],
      });
    }
    if (data.discountType === "fixed" && !Number.isInteger(data.discountValue)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Desconto fixo deve ser em centavos (inteiro)",
        path: ["discountValue"],
      });
    }
    if (data.startsAt && data.endsAt && new Date(data.endsAt) <= new Date(data.startsAt)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Data final deve ser após o início",
        path: ["endsAt"],
      });
    }
  });

export const couponUpdateSchema = z
  .object({
    description: z.string().trim().max(240).optional().nullable().or(z.literal("")),
    discountType: z.enum(["percent", "fixed"]).optional(),
    discountValue: z.coerce.number().positive().optional(),
    eventId: z.string().uuid().optional().nullable().or(z.literal("")),
    promoterId: z.string().uuid().optional().nullable().or(z.literal("")),
    maxUses: z.coerce.number().int().positive().optional().nullable().or(z.literal("")),
    startsAt: z.string().datetime().optional().nullable().or(z.literal("")),
    endsAt: z.string().datetime().optional().nullable().or(z.literal("")),
    isActive: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.discountType === "percent" && data.discountValue != null && data.discountValue > 100) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Desconto percentual máximo é 100%",
        path: ["discountValue"],
      });
    }
  });

export const checkinSchema = z.object({
  // Signed PP1./PPW1. JWTs, 8-char gate code (AB12-CD34), or legacy 64-hex emergency token.
  qrToken: z.string().trim().min(8).max(2048),
  /** Selected door/event — required so staff cannot check in the wrong night. */
  eventId: z.string().uuid(),
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

export const adminStaffSchema = z.object({
  email: z.string().trim().toLowerCase().email("E-mail inválido"),
  role: z.enum(["checkin", "customer"]),
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
