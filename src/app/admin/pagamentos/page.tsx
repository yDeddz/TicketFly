import { Money, paymentStatusLabel } from "@/components/status-badges";
import { formatDateTime } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function AdminPaymentsPage() {
  const admin = createAdminClient();
  const { data: payments } = await admin
    .from("payments")
    .select("id,amount_cents,platform_fee_cents,platform_fee_share_cents,partner_fee_share_cents,insurance_cents,net_amount_cents,status,provider,created_at,events(title)")
    .order("created_at", { ascending: false })
    .limit(150);

  return (
    <div className="grid gap-4">
      <div>
        <h2 className="text-2xl font-black">Pagamentos</h2>
        <p className="mt-1 text-sm text-[#c9aabc]">
          GMV, taxa (split TF/parceiro), seguro e líquido do parceiro.
        </p>
      </div>
      <div className="overflow-hidden rounded-2xl border border-[#ff1493]/25 bg-[#120410]">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-white/10 text-xs uppercase tracking-wide text-white/45">
              <tr>
                <th className="px-4 py-3">Evento</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Taxa</th>
                <th className="px-4 py-3">TF / Parceiro</th>
                <th className="px-4 py-3">Seguro</th>
                <th className="px-4 py-3">Líquido</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Quando</th>
              </tr>
            </thead>
            <tbody>
              {(payments ?? []).map((payment) => {
                const event = Array.isArray(payment.events) ? payment.events[0] : payment.events;
                return (
                  <tr key={payment.id} className="border-b border-white/8 last:border-0">
                    <td className="px-4 py-4 font-semibold">{event?.title ?? "—"}</td>
                    <td className="px-4 py-4"><Money cents={payment.amount_cents} /></td>
                    <td className="px-4 py-4"><Money cents={payment.platform_fee_cents} /></td>
                    <td className="px-4 py-4 text-white/70">
                      <Money cents={payment.platform_fee_share_cents ?? 0} /> /{" "}
                      <Money cents={payment.partner_fee_share_cents ?? 0} />
                    </td>
                    <td className="px-4 py-4"><Money cents={payment.insurance_cents ?? 0} /></td>
                    <td className="px-4 py-4"><Money cents={payment.net_amount_cents} /></td>
                    <td className="px-4 py-4">{paymentStatusLabel(payment.status)}</td>
                    <td className="px-4 py-4 text-white/50">{formatDateTime(payment.created_at)}</td>
                  </tr>
                );
              })}
              {(payments?.length ?? 0) === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-white/45">Nenhum pagamento ainda.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
