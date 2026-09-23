import { describe, expect, it } from "vitest";

import { buildTicketEmail } from "@/lib/tickets/ticket-email";

describe("buildTicketEmail", () => {
  it("puts the door code and the ticket link in the message", () => {
    const message = buildTicketEmail({
      buyerName: "Ana <script>",
      eventTitle: "Noite Rosa",
      when: "23 de set. de 2026, 22:00",
      venue: "Casa · SP",
      doorCode: "AB12-CD34",
      ticketUrl: "https://www.ticketfly.app/ingressos/abc?access=1",
    });

    expect(message.subject).toContain("Noite Rosa");
    expect(message.text).toContain("AB12-CD34");
    expect(message.html).toContain("AB12-CD34");
    expect(message.html).toContain("https://www.ticketfly.app/ingressos/abc?access=1");
    expect(message.html).not.toContain("<script>");
  });
});
