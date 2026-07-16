import Link from "next/link";

import { formatCurrency } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function PaymentStatusPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = createAdminClient();
  const { data: payment } = await admin
    .from("payments")
    .select("id,status,amount_cents,checkout_url,tickets(code,status,buyer_email)")
    .eq("id", id)
    .single();

  const ticket = Array.isArray(payment?.tickets) ? payment?.tickets[0] : payment?.tickets;

  return (
    <main className="mx-auto grid max-w-3xl gap-5 px-4 py-10">
      <div className="rounded-lg border border-[#ff1493]/30 bg-[#120410] p-6 shadow-sm shadow-[#ff1493]/10">
        <p className="text-sm font-bold uppercase text-[#ff1493]">Status do pagamento</p>
        <h1 className="mt-2 text-3xl font-black">
          {payment?.status === "approved" ? "Pagamento aprovado" : "Pagamento em processamento"}
        </h1>
        <p className="mt-3 text-[#c9aabc]">
          Valor: {payment ? formatCurrency(payment.amount_cents) : "-"} · Status: {payment?.status ?? "não encontrado"}
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          {payment?.status === "approved" && ticket?.code ? (
            <Link className="rounded-md bg-[#ff1493] px-4 py-3 font-bold text-white" href={`/ingressos/${ticket.code}`}>
              Ver ingresso
            </Link>
          ) : null}
          {payment?.checkout_url && payment.status !== "approved" ? (
            <Link className="rounded-md bg-[#ff1493] px-4 py-3 font-bold text-white" href={payment.checkout_url}>
              Voltar ao pagamento
            </Link>
          ) : null}
        </div>
      </div>
    </main>
  );
}
