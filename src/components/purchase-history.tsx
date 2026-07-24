import { CheckCircle2, RotateCcw, Ticket } from "lucide-react";

import { formatCurrency } from "@/lib/format";
import type { PurchaseRecord } from "@/lib/ticketfly-data";

const STATUS = {
  Concluido: { icon: CheckCircle2, className: "text-[#5cffb0]" },
  Utilizado: { icon: Ticket, className: "text-white/50" },
  Reembolsado: { icon: RotateCcw, className: "text-[#ffb45c]" },
} as const;

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).format(
    new Date(iso),
  );
}

export function PurchaseHistory({ records }: { records: PurchaseRecord[] }) {
  return (
    <ul className="divide-y divide-white/6">
      {records.map((record) => {
        const status = STATUS[record.status];
        const Icon = status.icon;
        return (
          <li key={record.id} className="flex items-center gap-3 py-3.5 first:pt-0 last:pb-0">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/8 bg-white/[0.03]">
              <Icon className={`h-4 w-4 ${status.className}`} aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-white">{record.title}</p>
              <p className="text-xs text-white/45">
                {formatDate(record.date)} · {record.status}
              </p>
            </div>
            <span className="shrink-0 text-sm font-semibold text-white/80">
              {formatCurrency(record.amount_cents)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
