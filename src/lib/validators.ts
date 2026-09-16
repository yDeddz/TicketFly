import { z } from "zod";

export function normalizeCpf(value: string) {
  return value.replace(/\D/g, "");
}

export function normalizeDocument(value: string) {
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

export function isValidCnpj(value: string) {
  const cnpj = normalizeDocument(value);
  if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) return false;

  const calc = (baseLength: number) => {
    const weights =
      baseLength === 12
        ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
        : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = weights.reduce((acc, weight, index) => acc + Number(cnpj[index]) * weight, 0);
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };

  return calc(12) === Number(cnpj[12]) && calc(13) === Number(cnpj[13]);
}

export function isValidCpfOrCnpj(value: string) {
  const digits = normalizeDocument(value);
  if (digits.length === 11) return isValidCpf(digits);
  if (digits.length === 14) return isValidCnpj(digits);
  return false;
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

const brazilianDocumentSchema = z
  .string()
  .trim()
  .transform(normalizeDocument)
  .refine(isValidCpfOrCnpj, "CPF ou CNPJ inválido");

const httpsUrlSchema = z
  .string()
  .trim()
  .url("URL inválida")
  .refine((url) => /^https:\/\//i.test(url), "Use uma URL https");

const companyTypeSchema = z.enum(["MEI", "LIMITED", "INDIVIDUAL", "ASSOCIATION"]);

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

const eventBatchInputSchema = z.object({
  name: z.string().trim().min(2).max(80),
  priceCents: z.coerce.number().int().min(0),
  quantityTotal: z.coerce.number().int().min(1).max(100000),
});

const eventFieldsSchema = z.object({
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().max(3000).optional(),
  venueName: z.string().trim().min(2).max(140),
  address: z.string().trim().min(5).max(240),
  city: z.string().trim().min(2).max(100),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime().optional().or(z.literal("")),
  coverImageUrl: httpsUrlSchema.optional().or(z.literal("")),
  batch: eventBatchInputSchema.optional(),
});

function endsAfterStart(event: { startsAt: string; endsAt?: string }) {
  return !event.endsAt || new Date(event.endsAt).getTime() > new Date(event.startsAt).getTime();
}

export const eventSchema = eventFieldsSchema.refine(endsAfterStart, {
  message: "A data de término precisa ser posterior ao início",
  path: ["endsAt"],
});

export const organizerEventUpdateSchema = z
  .object({
    status: z.enum(["draft", "published", "cancelled", "finished"]).optional(),
    title: z.string().trim().min(3).max(120).optional(),
    description: z.string().trim().max(3000).optional().or(z.literal("")),
    venueName: z.string().trim().min(2).max(140).optional(),
    address: z.string().trim().min(5).max(240).optional(),
    city: z.string().trim().min(2).max(100).optional(),
    startsAt: z.string().datetime().optional(),
    endsAt: z.string().datetime().optional().or(z.literal("")),
    coverImageUrl: httpsUrlSchema.optional().or(z.literal("")),
  })
  .refine(
    (event) => {
      if (!event.startsAt || !event.endsAt) return true;
      return new Date(event.endsAt).getTime() > new Date(event.startsAt).getTime();
    },
    {
      message: "A data de término precisa ser posterior ao início",
      path: ["endsAt"],
    },
  );

export const adminEventUpdateSchema = eventFieldsSchema
  .extend({
    status: z.enum(["draft", "published", "cancelled", "finished"]),
  })
  .refine(endsAfterStart, {
    message: "A data de término precisa ser posterior ao início",
    path: ["endsAt"],
  });

export const batchSchema = z.object({
  eventId: z.string().uuid(),
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(500).optional(),
  priceCents: z.coerce.number().int().min(0),
  quantityTotal: z.coerce.number().int().min(1).max(100000),
  salesEndAt: z.string().datetime().optional().or(z.literal("")),
  switchAt: z.string().datetime().optional().or(z.literal("")),
});

export const batchUpdateSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  priceCents: z.coerce.number().int().min(0).optional(),
  quantityTotal: z.coerce.number().int().min(1).max(100000).optional(),
  salesEndAt: z.string().datetime().optional().nullable().or(z.literal("")),
  isActive: z.boolean().optional(),
});

export const adminOrganizerUpdateSchema = z.object({
  status: z.enum(["pending", "approved", "rejected", "suspended"]),
  feeThresholdCents: z.coerce.number().int().min(0).max(10_000_000),
  feePercentUptoThreshold: z.coerce.number().min(0).max(40),
  feePercentAboveThreshold: z.coerce.number().min(0).max(40),
  serviceFeePlatformSharePercent: z.coerce.number().min(0).max(100).default(50),
  pagarmeRecipientId: z
    .string()
    .trim()
    .regex(/^rp_[A-Za-z0-9]+$/, "Recipient ID Pagar.me inválido")
    .optional()
    .or(z.literal("")),
});

export const organizerApplySchema = z.object({
  tradeName: z.string().trim().min(2).max(120),
  legalName: z.string().trim().min(2).max(160),
  document: brazilianDocumentSchema,
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  city: z.string().trim().max(100).optional().or(z.literal("")),
  feeNote: z.string().trim().max(1000).optional().or(z.literal("")),
});

export const organizerProfileSchema = z
  .object({
    tradeName: z.string().trim().min(2).max(120),
    legalName: z.string().trim().min(2).max(160),
    document: brazilianDocumentSchema,
    phone: brazilianPhoneSchema,
    city: z.string().trim().min(2).max(100),
    address: z.string().trim().min(2).max(200),
    addressNumber: z.string().trim().min(1).max(20),
    complement: z.string().trim().max(100).optional().or(z.literal("")),
    province: z.string().trim().min(2).max(100),
    postalCode: z
      .string()
      .trim()
      .transform((value) => value.replace(/\D/g, ""))
      .refine((value) => value.length === 8, "CEP inválido"),
    birthDate: z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Use AAAA-MM-DD")
      .optional()
      .or(z.literal("")),
    companyType: companyTypeSchema.optional().or(z.literal("")),
  })
  .superRefine((data, ctx) => {
    if (data.document.length === 11 && !data.birthDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Informe a data de nascimento para CPF",
        path: ["birthDate"],
      });
    }
    if (data.document.length === 14 && !data.companyType) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Informe o tipo da empresa para CNPJ",
        path: ["companyType"],
      });
    }
  });

export const asaasConnectSchema = z.object({
  tradeName: z.string().trim().min(2).max(120).optional(),
  legalName: z.string().trim().min(2).max(160).optional(),
  document: z.string().trim().optional(),
  email: z.string().trim().email().max(160).optional().or(z.literal("")),
  phone: z.string().trim().optional(),
  city: z.string().trim().optional(),
  address: z.string().trim().optional(),
  addressNumber: z.string().trim().optional(),
  complement: z.string().trim().optional(),
  province: z.string().trim().optional(),
  postalCode: z.string().trim().optional(),
  birthDate: z.string().trim().optional(),
  companyType: companyTypeSchema.optional().or(z.literal("")),
});

export const adminStaffSchema = z.object({
  email: z.string().trim().toLowerCase().email("E-mail inválido"),
  role: z.enum(["checkin", "customer"]),
});

export const createContractSchema = z.object({
  email: z.string().trim().email(),
  tradeName: z.string().trim().min(2).max(120),
  legalName: z.string().trim().min(2).max(160),
  document: brazilianDocumentSchema,
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  city: z.string().trim().max(100).optional().or(z.literal("")),
  partnershipNotes: z.string().trim().max(1000).optional().or(z.literal("")),
  feeThresholdCents: z.coerce.number().int().min(0).max(10_000_000).default(12000),
  feePercentUptoThreshold: z.coerce.number().min(0).max(40).default(12),
  feePercentAboveThreshold: z.coerce.number().min(0).max(40).default(12),
  serviceFeePlatformSharePercent: z.coerce.number().min(0).max(100).default(50),
  status: z.enum(["pending", "approved", "rejected", "suspended"]).default("approved"),
});
