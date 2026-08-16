import { describe, expect, it } from "vitest";

import { checkoutSchema, isValidCpf, normalizeCpf } from "@/lib/validators";

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
