import Link from "next/link";

import { DoorPaymentClient } from "@/components/door-payment-client";
import { loadDoorSaleStatus } from "@/lib/payments/door-sales-status";
import { verifyDoorPaymentAccessToken } from "@/lib/ticket-crypto";

export const dynamic = "force-dynamic";

export default async function DoorPaymentPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const decodedToken = decodeURIComponent(token);
  const claims = await verifyDoorPaymentAccessToken(decodedToken);
  const state = claims ? await loadDoorSaleStatus(claims.paymentId) : null;

  if (!claims || !state) {
    return (
      <main className="mx-auto max-w-xl px-4 pb-16 pt-10">
        <div className="rounded-2xl border border-[#ff3b6b]/30 bg-[#120410] p-6">
          <h1 className="text-2xl font-black">Link inválido ou expirado</h1>
          <p className="mt-2 text-sm text-white/60">
            Peça à bilheteria para gerar ou compartilhar novamente o pagamento.
          </p>
          <Link
            href="/eventos"
            className="mt-5 inline-flex rounded-full bg-[#ff1493] px-4 py-3 text-sm font-bold text-white"
          >
            Ver eventos
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-xl px-4 pb-16 pt-8">
      <DoorPaymentClient
        token={decodedToken}
        initial={{
          paymentId: state.paymentId,
          status: state.status,
          amountCents: state.amountCents,
          paymentMethod: state.paymentMethod as "pix" | "credit_card",
          checkoutUrl: state.checkoutUrl,
          pix: state.pix,
          ticketHref: state.ticketHref,
          ticketStatus: state.ticketStatus,
          eventTitle: state.eventTitle,
          batchName: state.batchName,
        }}
      />
    </main>
  );
}

