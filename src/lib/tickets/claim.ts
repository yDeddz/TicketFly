import { createAdminClient } from "@/lib/supabase/admin";

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function findBuyerUserIdByEmail(email: string) {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;

  const admin = createAdminClient();
  const { data, error } = await admin.from("users").select("id").eq("email", normalized).maybeSingle();

  if (error || !data?.id) return null;
  return data.id as string;
}

export async function resolveBuyerUserId(args: { sessionUserId?: string | null; email: string }) {
  if (args.sessionUserId) return args.sessionUserId;
  return findBuyerUserIdByEmail(args.email);
}

/**
 * Attach unpaid/unlinked tickets for this e-mail to the logged-in account.
 * Never steals a ticket already owned by another user.
 */
export async function claimTicketsForBuyer(args: { userId: string; email: string }) {
  const email = normalizeEmail(args.email);
  if (!args.userId || !email) {
    return { ok: false as const, claimed: 0, error: "invalid_args" };
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("tickets")
    .update({ buyer_user_id: args.userId })
    .eq("buyer_email", email)
    .is("buyer_user_id", null)
    .select("id");

  if (error) {
    return { ok: false as const, claimed: 0, error: error.message };
  }

  return { ok: true as const, claimed: data?.length ?? 0 };
}

/** After payment approval, bind the ticket to an existing account with the same e-mail. */
export async function attachPaidTicketsToBuyerAccount(paymentId: string) {
  const admin = createAdminClient();
  const { data: tickets, error } = await admin
    .from("tickets")
    .select("id,buyer_email,buyer_user_id")
    .eq("payment_id", paymentId);

  if (error || !tickets?.length) return { attached: 0 };

  let attached = 0;
  for (const ticket of tickets) {
    if (ticket.buyer_user_id) continue;
    const userId = await findBuyerUserIdByEmail(ticket.buyer_email ?? "");
    if (!userId) continue;

    const { error: updateError } = await admin
      .from("tickets")
      .update({ buyer_user_id: userId })
      .eq("id", ticket.id)
      .is("buyer_user_id", null);

    if (!updateError) attached += 1;
  }

  return { attached };
}
