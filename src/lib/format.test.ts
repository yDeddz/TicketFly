import { describe, expect, it } from "vitest";

import { centsToReaisInput, reaisToCents } from "@/lib/format";

describe("reaisToCents", () => {
  it("parses Brazilian currency", () => {
    expect(reaisToCents("120,00")).toBe(12_000);
    expect(reaisToCents("1.200,50")).toBe(120_050);
  });
});

describe("centsToReaisInput", () => {
  it("formats cents for inputs", () => {
    expect(centsToReaisInput(12_000)).toBe("120,00");
  });
});
