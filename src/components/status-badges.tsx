import { formatCurrency } from "@/lib/format";

export function ticketStatusLabel(status: string) {
  switch (status) {
    case "pending":
      return "Pendente";
    case "paid":
      return "Pago · QR livre";
    case "used":
      return "Usado · QR validado";
    case "cancelled":
      return "Cancelado / reembolsado";
    default:
      return status;
  }
}

export function ticketStatusTone(status: string) {
  switch (status) {
    case "paid":
      return "border-emerald-400/30 bg-emerald-400/10 text-emerald-200";
    case "used":
      return "border-sky-400/30 bg-sky-400/10 text-sky-200";
    case "pending":
      return "border-amber-400/30 bg-amber-400/10 text-amber-100";
    case "cancelled":
      return "border-white/15 bg-white/5 text-white/55";
    default:
      return "border-white/15 bg-white/5 text-white/70";
  }
}

export function TicketStatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${ticketStatusTone(status)}`}>
      {ticketStatusLabel(status)}
    </span>
  );
}

export function paymentStatusLabel(status: string) {
  switch (status) {
    case "approved":
      return "Aprovado";
    case "pending":
      return "Pendente";
    case "rejected":
      return "Recusado";
    case "cancelled":
      return "Cancelado";
    case "refunded":
      return "Reembolsado";
    default:
      return status;
  }
}

export function Money({ cents }: { cents: number }) {
  return <>{formatCurrency(cents)}</>;
}
