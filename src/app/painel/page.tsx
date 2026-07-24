import Link from "next/link";
import { redirect } from "next/navigation";
import { CreditCard, Heart, Plus, Sparkles } from "lucide-react";

import { Badge } from "@/components/badge";
import { PurchaseHistory } from "@/components/purchase-history";
import { QuickAction } from "@/components/quick-action";
import { SectionTitle } from "@/components/section-title";
import { TicketCard } from "@/components/ticket-card";
import { UpcomingEvent } from "@/components/upcoming-event";
import { UserGreeting } from "@/components/user-greeting";
import { formatCurrency } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { signTicketAccessToken } from "@/lib/ticket-crypto";
import {
  paymentMethods,
  showcaseEvents,
  type PurchaseRecord,
  type TicketTier,
  type WalletTicket,
} from "@/lib/ticketfly-data";

export const dynamic = "force-dynamic";

function inferTier(name: string): TicketTier {
  const lower = name.toLowerCase();
  if (lower.includes("vip")) return "VIP";
  if (lower.includes("camarote") || lower.includes("sky")) return "Camarote";
  return "Pista";
}

function unwrap<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export default async function MyTicketsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent("/painel")}`);
  }

  const admin = createAdminClient();
  const email = user.email?.toLowerCase() ?? "";

  let query = admin
    .from("tickets")
    .select(
      "id,code,status,amount_paid_cents,buyer_email,buyer_name,created_at,events(title,slug,starts_at,city,venue_name,cover_image_url),ticket_batches(name)",
    )
    .in("status", ["paid", "used", "cancelled"])
    .order("created_at", { ascending: false })
    .limit(40);

  if (user.id && email) {
    query = query.or(`buyer_user_id.eq.${user.id},buyer_email.eq.${email}`);
  } else if (user.id) {
    query = query.eq("buyer_user_id", user.id);
  } else {
    query = query.eq("buyer_email", email);
  }

  const { data: rows } = await query;

  const tickets: WalletTicket[] = [];
  const history: PurchaseRecord[] = [];

  for (const row of rows ?? []) {
    const event = unwrap(
      row.events as
        | {
            title: string;
            slug: string | null;
            starts_at: string;
            city: string | null;
            venue_name: string;
            cover_image_url: string | null;
          }
        | {
            title: string;
            slug: string | null;
            starts_at: string;
            city: string | null;
            venue_name: string;
            cover_image_url: string | null;
          }[]
        | null,
    );
    const batch = unwrap(row.ticket_batches as { name: string } | { name: string }[] | null);
    if (!event) continue;

    let accessToken: string | undefined;
    try {
      accessToken = await signTicketAccessToken({
        code: row.code,
        buyerEmail: row.buyer_email,
      });
    } catch {
      accessToken = undefined;
    }

    const mapped: WalletTicket = {
      id: row.id,
      code: row.code,
      slug: event.slug ?? row.code,
      title: event.title,
      cover_image_url:
        event.cover_image_url ||
        "https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?auto=format&fit=crop&w=1200&q=85",
      starts_at: event.starts_at,
      city: event.city ?? "",
      venue_name: event.venue_name,
      tier: inferTier(batch?.name ?? "Pista"),
      price_cents: row.amount_paid_cents ?? 0,
      qrReady: row.status === "paid",
      accessToken,
      status: row.status,
    };

    if (row.status === "paid") {
      tickets.push(mapped);
    }

    history.push({
      id: row.id,
      title: event.title,
      date: event.starts_at,
      amount_cents: row.amount_paid_cents ?? 0,
      status:
        row.status === "used"
          ? "Utilizado"
          : row.status === "cancelled"
            ? "Reembolsado"
            : "Concluido",
    });
  }

  tickets.sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());

  const nextEvent = tickets[0];
  const invested = history.reduce((sum, item) => sum + item.amount_cents, 0);
  const ownedSlugs = new Set(tickets.map((ticket) => ticket.slug));
  const recommended = showcaseEvents.filter((event) => !ownedSlugs.has(event.slug)).slice(0, 3);
  const favorites = showcaseEvents.slice(0, 3);
  const firstName =
    (typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name.split(" ")[0]
      : null) ||
    user.email?.split("@")[0] ||
    "você";

  const summary = [
    { label: "Ingressos", value: `${tickets.length}` },
    {
      label: "Próximo evento",
      value: nextEvent?.title ?? "—",
      hint: nextEvent
        ? new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(new Date(nextEvent.starts_at))
        : undefined,
    },
    { label: "Acesso", value: tickets.some((t) => t.tier === "VIP") ? "VIP" : "Padrão" },
    { label: "Total investido", value: formatCurrency(invested) },
  ];

  return (
    <main className="px-4 pb-20 pt-8 lg:px-6">
      <div className="mx-auto max-w-6xl space-y-10">
        <header className="rise-in space-y-6">
          <UserGreeting name={firstName} activeCount={tickets.length} />

          <dl className="surface grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-white/[0.04] sm:grid-cols-4">
            {summary.map((item) => (
              <div key={item.label} className="bg-[#0a080c]/60 p-4">
                <dt className="text-xs font-medium uppercase tracking-wide text-white/45">{item.label}</dt>
                <dd className="mt-1.5 truncate text-lg font-semibold text-white">
                  {item.value}
                  {item.hint ? <span className="ml-1.5 text-sm font-normal text-white/45">{item.hint}</span> : null}
                </dd>
              </div>
            ))}
          </dl>
        </header>

        <section className="space-y-5">
          <SectionTitle
            eyebrow="Prontos para uso"
            title="Ingressos ativos"
            description="QR dinâmico assinado + Wallet. Toque em abrir para a sessão de entrada."
          />
          {tickets.length === 0 ? (
            <div className="surface rounded-2xl p-8 text-center">
              <p className="text-white/70">Você ainda não tem ingressos pagos.</p>
              <Link href="/eventos" className="neon-button btn mt-4 inline-flex h-11 px-5 text-sm">
                Explorar eventos
              </Link>
            </div>
          ) : (
            <div className="grid gap-4">
              {tickets.map((ticket, index) => (
                <div key={ticket.id} className="rise-in" style={{ animationDelay: `${index * 60}ms` }}>
                  <TicketCard ticket={ticket} />
                </div>
              ))}
            </div>
          )}
        </section>

        <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
          <div className="space-y-8">
            <section className="space-y-4">
              <SectionTitle
                title="Próximos eventos"
                description="Sugestões que combinam com você."
                action={{ label: "Explorar", href: "/eventos" }}
              />
              <div className="grid gap-3">
                {recommended.map((event) => (
                  <UpcomingEvent key={event.id} event={event} />
                ))}
              </div>
            </section>

            <section className="space-y-4">
              <SectionTitle title="Histórico" description="Suas compras anteriores." />
              <div className="surface rounded-2xl p-5">
                <PurchaseHistory records={history.slice(0, 12)} />
              </div>
            </section>
          </div>

          <aside className="space-y-6">
            <section className="surface space-y-4 rounded-2xl p-5">
              <div className="flex items-center justify-between">
                <h3 className="flex items-center gap-2 font-semibold text-white">
                  <Heart className="h-4 w-4 text-[#ff1493]" aria-hidden />
                  Favoritos
                </h3>
                <Link href="/eventos" className="text-xs font-semibold text-white/50 transition-colors hover:text-white">
                  Ver todos
                </Link>
              </div>
              <ul className="space-y-2.5">
                {favorites.map((event) => (
                  <li key={event.id}>
                    <Link
                      href={`/eventos/${event.slug}`}
                      className="group flex items-center gap-3 rounded-xl border border-transparent p-2 transition-colors hover:border-white/10 hover:bg-white/[0.03]"
                    >
                      <span
                        className="h-10 w-10 shrink-0 rounded-lg bg-cover bg-center"
                        style={{ backgroundImage: `url(${event.cover_image_url})` }}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-white">{event.title}</span>
                        <span className="block truncate text-xs text-white/45">{event.city}</span>
                      </span>
                      <Badge variant="favorite" icon={null} className="px-2">
                        {event.category}
                      </Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>

            <section className="surface space-y-4 rounded-2xl p-5">
              <div className="flex items-center justify-between">
                <h3 className="flex items-center gap-2 font-semibold text-white">
                  <CreditCard className="h-4 w-4 text-[#ff1493]" aria-hidden />
                  Métodos de pagamento
                </h3>
              </div>
              <ul className="space-y-2.5">
                {paymentMethods.map((method) => (
                  <li
                    key={method.id}
                    className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/[0.02] p-3"
                  >
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/[0.04] text-white/70">
                      <CreditCard className="h-4 w-4" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-white">{method.label}</span>
                      <span className="block truncate text-xs text-white/45">{method.detail}</span>
                    </span>
                    {method.primary ? <Badge variant="neutral">Padrão</Badge> : null}
                  </li>
                ))}
              </ul>
              <button type="button" className="ghost-button btn h-10 w-full text-sm">
                <Plus className="h-4 w-4" aria-hidden />
                Adicionar método
              </button>
            </section>

            <QuickAction
              icon={Sparkles}
              title="Upgrades disponíveis"
              description="Áreas premium e lotes exclusivos"
              href="/eventos?categoria=vip"
            />
          </aside>
        </div>
      </div>
    </main>
  );
}
