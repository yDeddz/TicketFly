"use client";

import { Loader2, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { DownloadTicketButton } from "@/components/download-ticket-button";
import { SendTicketEmailButton } from "@/components/send-ticket-email-button";
import { paymentStatusLabel } from "@/components/status-badges";
import { TicketQrLive } from "@/components/ticket-qr-live";
import { AlertBanner } from "@/components/ui/alert-banner";
import { formatCurrency } from "@/lib/format";

type PaymentStatus = "pending" | "approved" | "rejected" | "cancelled" | "refunded" | string;

type StatusPayload = {
  id: string;
  status: PaymentStatus;
  amount_cents: number;
  checkout_url: string | null;
  tickets?:
    | { code: string; status: string; buyer_email: string | null; buyer_name?: string | null }
    | { code: string; status: string; buyer_email: string | null; buyer_name?: string | null }[]
    | null;
  ticketHref?: string | null;
  ticketCode?: string | null;
  ticketAccess?: string | null;
};

const copy: Record<string, { title: string; body: string; tone: "success" | "warning" | "error" | "info" }> = {
  approved: {
    title: "Pagamento aprovado",
    body: "Seu ingresso está liberado. Ele também ficou salvo em Meus Ingressos, no seu perfil.",
    tone: "success",
  },
  pending: {
    title: "Pagamento em processamento",
    body: "Assim que o pagamento confirmar, o ingresso libera automaticamente. Você pode atualizar abaixo.",
    tone: "info",
  },
  rejected: {
    title: "Pagamento recusado",
    body: "Este pagamento não foi aprovado. Tente novamente com outro meio de pagamento.",
    tone: "error",
  },
  cancelled: {
    title: "Pagamento cancelado",
    body: "Esta cobrança foi cancelada. Se ainda quiser o ingresso, inicie uma nova compra.",
    tone: "warning",
  },
  refunded: {
    title: "Pagamento reembolsado",
    body: "O valor foi estornado. O ingresso correspondente não é mais válido na porta.",
    tone: "warning",
  },
};

function unwrapTicket(tickets: StatusPayload["tickets"]) {
  if (!tickets) return null;
  return Array.isArray(tickets) ? (tickets[0] ?? null) : tickets;
}

export function PaymentStatusClient({
  paymentId,
  initial,
  ticketHref: initialTicketHref,
  loggedIn = false,
}: {
  paymentId: string;
  initial: StatusPayload | null;
  ticketHref?: string | null;
  loggedIn?: boolean;
}) {
  const [payment, setPayment] = useState<StatusPayload | null>(initial);
  const [ticketHref, setTicketHref] = useState(initialTicketHref ?? initial?.ticketHref ?? null);
  const [ticketCode, setTicketCode] = useState(initial?.ticketCode ?? unwrapTicket(initial?.tickets)?.code ?? null);
  const [ticketAccess, setTicketAccess] = useState(initial?.ticketAccess ?? null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [pollCount, setPollCount] = useState(0);
  const alive = useRef(true);

  const refresh = useCallback(
    async (silent = false) => {
      if (!silent) setRefreshing(true);
      setError("");
      try {
        const response = await fetch(`/api/payments/${paymentId}/status`, { cache: "no-store" });
        const body = await response.json().catch(() => null);
        if (!response.ok) {
          setError(body?.error ?? "Não foi possível atualizar o status");
          return;
        }
        setPayment(body);
        if (body.status === "approved") {
          if (body.ticketHref) setTicketHref(body.ticketHref);
          if (body.ticketCode) setTicketCode(body.ticketCode);
          if (body.ticketAccess) setTicketAccess(body.ticketAccess);
        }
        setPollCount((n) => n + 1);
      } catch {
        setError("Não foi possível atualizar agora. Verifique sua conexão.");
      } finally {
        if (!silent) setRefreshing(false);
      }
    },
    [paymentId],
  );

  useEffect(() => {
    alive.current = true;
    if (payment?.status !== "pending") return;

    const id = window.setInterval(() => {
      if (!alive.current) return;
      void refresh(true);
    }, 4_000);

    return () => {
      alive.current = false;
      window.clearInterval(id);
    };
  }, [payment?.status, refresh]);

  if (!payment) {
    return (
      <div className="rounded-lg border border-[#ff1493]/30 bg-[#120410] p-6">
        <h1 className="text-3xl font-black">Pagamento não encontrado</h1>
        <p className="mt-3 text-[#c9aabc]">Confira o link ou inicie uma nova compra.</p>
        <Link className="mt-6 inline-block rounded-md bg-[#ff1493] px-4 py-3 font-bold text-white" href="/eventos">
          Ver eventos
        </Link>
      </div>
    );
  }

  const statusCopy = copy[payment.status] ?? copy.pending;
  const ticket = unwrapTicket(payment.tickets);
  const pendingTooLong = payment.status === "pending" && pollCount >= 15;
  const showTicket = payment.status === "approved" && ticketCode;
  const ticketPaid = ticket?.status === "paid" || payment.status === "approved";

  return (
    <div className="rounded-lg border border-[#ff1493]/30 bg-[#120410] p-6 shadow-sm shadow-[#ff1493]/10">
      <p className="text-sm font-bold uppercase text-[#ff1493]">Status do pagamento</p>
      <h1 className="mt-2 text-3xl font-black">{statusCopy.title}</h1>
      <p className="mt-3 text-[#c9aabc]">
        Valor: {formatCurrency(payment.amount_cents)}
        {payment.status ? ` · ${paymentStatusLabel(payment.status)}` : ""}
      </p>
      <p className="mt-2 text-sm text-white/55">{statusCopy.body}</p>

      {error ? (
        <AlertBanner tone="error" className="mt-4">
          {error}
        </AlertBanner>
      ) : null}

      {pendingTooLong ? (
        <AlertBanner tone="warning" className="mt-4">
          Ainda sem confirmação após alguns minutos. Se você já pagou, aguarde o e-mail ou fale com o
          suporte informando o e-mail da compra.
        </AlertBanner>
      ) : null}

      {showTicket && ticketPaid ? (
        <div className="mt-6 grid gap-4 rounded-xl border border-[#ff1493]/25 bg-black/25 p-4">
          <TicketQrLive
            code={ticketCode}
            accessToken={ticketAccess}
            initialStatus="paid"
            buyerName={ticket?.buyer_name}
          />
          <DownloadTicketButton
            code={ticketCode}
            accessToken={ticketAccess}
            className="w-full [&_button]:w-full [&_button]:justify-center"
          />
          <SendTicketEmailButton code={ticketCode} accessToken={ticketAccess} />
        </div>
      ) : null}

      <div className="mt-6 flex flex-wrap gap-3">
        {payment.status === "approved" && ticketHref ? (
          <Link className="rounded-md bg-[#ff1493] px-4 py-3 font-bold text-white" href={ticketHref}>
            Abrir ingresso
          </Link>
        ) : null}

        {payment.status === "approved" ? (
          <Link
            className="rounded-md border border-white/15 px-4 py-3 font-bold text-white/85"
            href="/painel"
          >
            Ver no meu perfil
          </Link>
        ) : null}

        {payment.status === "approved" && !loggedIn ? (
          <Link
            className="rounded-md border border-white/15 px-4 py-3 font-bold text-white/85"
            href={`/login?next=${encodeURIComponent("/painel")}`}
          >
            Entrar para salvar no perfil
          </Link>
        ) : null}

        {payment.checkout_url && payment.status === "pending" ? (
          <Link className="rounded-md bg-[#ff1493] px-4 py-3 font-bold text-white" href={payment.checkout_url}>
            Voltar ao pagamento
          </Link>
        ) : null}

        {(payment.status === "rejected" || payment.status === "cancelled") && (
          <Link className="rounded-md bg-[#ff1493] px-4 py-3 font-bold text-white" href="/eventos">
            Tentar de novo
          </Link>
        )}

        {payment.status === "pending" ? (
          <button
            type="button"
            disabled={refreshing}
            onClick={() => void refresh(false)}
            className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-white/15 px-4 py-3 font-bold text-white/80 disabled:opacity-60"
          >
            {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Já paguei — atualizar
          </button>
        ) : null}
      </div>

      {payment.status === "approved" ? (
        <p className="mt-4 text-xs text-[#c9aabc]">
          {loggedIn
            ? "Se sair desta página, abra Meus Ingressos no seu perfil. Você também pode baixar o arquivo do ingresso."
            : "Entre com o mesmo e-mail da compra para o ingresso aparecer em Meus Ingressos, mesmo se você sair desta página."}
        </p>
      ) : null}

      {payment.status === "pending" ? (
        <p className="mt-4 flex items-center gap-2 text-xs text-white/40">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Atualizando automaticamente…
        </p>
      ) : null}
    </div>
  );
}
