import { describe, expect, it } from "vitest";

import { gateCodeIsStable } from "@/lib/tickets/gate-code";

const now = new Date("2026-09-23T12:00:00.000Z");
const eventEnd = new Date("2026-10-01T06:00:00.000Z");

describe("gateCodeIsStable", () => {
  it("rejects a code that dies in 90 seconds", () => {
    expect(
      gateCodeIsStable({
        manualCode: "AB12CD34",
        manualCodeExpiresAt: new Date(now.getTime() + 90_000).toISOString(),
        targetExpiresAt: eventEnd,
        now,
      }),
    ).toBe(false);
  });

  it("keeps a code that already lasts until the event window", () => {
    expect(
      gateCodeIsStable({
        manualCode: "AB12CD34",
        manualCodeExpiresAt: eventEnd.toISOString(),
        targetExpiresAt: eventEnd,
        now,
      }),
    ).toBe(true);
  });

  it("rejects an expired code", () => {
    expect(
      gateCodeIsStable({
        manualCode: "AB12CD34",
        manualCodeExpiresAt: new Date(now.getTime() - 1000).toISOString(),
        targetExpiresAt: eventEnd,
        now,
      }),
    ).toBe(false);
  });
});
