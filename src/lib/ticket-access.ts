import { createAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { verifyTicketAccessToken } from "@/lib/ticket-crypto";

export type TicketAccessRow = {
  id: string;
  code: string;
  qr_token: string;
  qr_version: number | null;
  status: string;
  buyer_name: string;
  buyer_email: string;
  buyer_user_id: string | null;
  amount_paid_cents: number;
  used_at: string | null;
  event_id: string;
  events:
    | {
        title: string;
        starts_at: string;
        ends_at: string | null;
        venue_name: string;
        address: string;
        city: string | null;
        cover_image_url: string | null;
        slug: string | null;
        organizer_id?: string;
      }
    | {
        title: string;
        starts_at: string;
        ends_at: string | null;
        venue_name: string;
        address: string;
        city: string | null;
        cover_image_url: string | null;
        slug: string | null;
        organizer_id?: string;
      }[]
    | null;
  ticket_batches:
    | { name: string }
    | { name: string }[]
    | null;
};

const TICKET_SELECT =
  "id,code,qr_token,qr_version,status,buyer_name,buyer_email,buyer_user_id,amount_paid_cents,used_at,event_id,events(title,starts_at,ends_at,venue_name,address,city,cover_image_url,slug,organizer_id),ticket_batches(name)";

export function unwrapRelation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export async function loadTicketByCode(code: string) {
  const admin = createAdminClient();
  const { data, error } = await admin.from("tickets").select(TICKET_SELECT).eq("code", code).maybeSingle();

  if (error || !data) return null;
  return data as TicketAccessRow;
}

/**
 * Authorize viewing / issuing QR for a ticket.
 * Allowed: logged-in buyer, admin, scoped checkin/organizer staff, or valid access JWT.
 */
export async function authorizeTicketAccess(args: {
  ticket: TicketAccessRow;
  accessToken?: string | null;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    if (args.ticket.buyer_user_id && args.ticket.buyer_user_id === user.id) {
      return { ok: true as const, via: "owner" as const, userId: user.id };
    }

    const email = user.email?.toLowerCase();
    if (email && email === args.ticket.buyer_email.toLowerCase()) {
      return { ok: true as const, via: "email" as const, userId: user.id };
    }

    const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).maybeSingle();

    if (profile?.role === "admin") {
      return { ok: true as const, via: "staff" as const, userId: user.id };
    }

    // Platform door staff can open any ticket QR for support / gate fallback.
    if (profile?.role === "checkin") {
      return { ok: true as const, via: "staff" as const, userId: user.id };
    }

    // Organizers may only mint QR for their own events (fail closed).
    if (profile?.role === "organizer") {
      const admin = createAdminClient();
      const { data: organizer } = await admin
        .from("organizers")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      const event = unwrapRelation(args.ticket.events);

      if (organizer?.id && event?.organizer_id && organizer.id === event.organizer_id) {
        return { ok: true as const, via: "staff" as const, userId: user.id };
      }
    }
  }

  if (args.accessToken) {
    const verified = await verifyTicketAccessToken(args.accessToken, args.ticket.code);
    if (verified && verified.email === args.ticket.buyer_email.toLowerCase()) {
      return { ok: true as const, via: "access_token" as const, userId: user?.id ?? null };
    }
  }

  return { ok: false as const, reason: "unauthorized" as const };
}

export function ticketIsQrEligible(status: string) {
  return status === "paid";
}
