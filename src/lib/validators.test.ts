import { describe, expect, it } from "vitest";

import { checkoutSchema, isValidCnpj, isValidCpf, isValidCpfOrCnpj, normalizeCpf, organizerProfileSchema } from "@/lib/validators";

const BATCH_ID = "550e8400-e29b-41d4-a716-446655440000";

describe("checkoutSchema", () => {
  it("requires a real buyer email", () => {
    const parsed = checkoutSchema.safeParse({
      batchId: BATCH_ID,
      buyerName: "Ana Teste",
      buyerEmail: "pending+abc@checkout.ticketfly.app",
    });
    expect(parsed.success).toBe(false);
  });

  it("accepts a complete checkout payload", () => {
    const parsed = checkoutSchema.safeParse({
      batchId: BATCH_ID,
      buyerName: "Ana Teste",
      buyerEmail: "ana@example.com",
      insuranceSelected: false,
    });
    expect(parsed.success).toBe(true);
  });
});

describe("cpf", () => {
  it("validates a well-known CPF", () => {
    expect(isValidCpf(normalizeCpf("390.533.447-05"))).toBe(true);
  });

  it("rejects repeated digits", () => {
    expect(isValidCpf("11111111111")).toBe(false);
  });
});

describe("cnpj", () => {
  it("validates a well-known CNPJ", () => {
    expect(isValidCnpj("11.444.777/0001-61")).toBe(true);
    expect(isValidCpfOrCnpj("11444777000161")).toBe(true);
  });

  it("rejects repeated digits", () => {
    expect(isValidCnpj("00000000000000")).toBe(false);
  });
});

describe("organizerProfileSchema", () => {
  it("requires birth date for CPF", () => {
    const parsed = organizerProfileSchema.safeParse({
      tradeName: "Club Neon",
      legalName: "Club Neon LTDA",
      document: "390.533.447-05",
      phone: "11999999999",
      city: "São Paulo",
      address: "Rua A",
      addressNumber: "10",
      province: "Centro",
      postalCode: "01310100",
    });
    expect(parsed.success).toBe(false);
  });

  it("accepts a complete PF profile", () => {
    const parsed = organizerProfileSchema.safeParse({
      tradeName: "Club Neon",
      legalName: "Joao da Silva",
      document: "390.533.447-05",
      phone: "11999999999",
      city: "São Paulo",
      address: "Rua A",
      addressNumber: "10",
      province: "Centro",
      postalCode: "01310-100",
      birthDate: "1990-01-15",
    });
    expect(parsed.success).toBe(true);
  });
});
