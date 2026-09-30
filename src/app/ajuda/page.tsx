import type { Metadata } from "next";
import Link from "next/link";

import { FAQ } from "@/components/ui/faq-tabs";
import { faqCategories, faqData } from "@/lib/faq-data";

export const metadata: Metadata = {
  title: "Central de Ajuda",
  description:
    "Perguntas frequentes sobre compra de ingressos, pagamentos, check-in, eventos e conta na TicketFly.",
};

export default function AjudaPage() {
  return (
    <main className="ticket-grid min-h-[70vh]">
      <FAQ
        title="Como podemos ajudar?"
        subtitle="Central de Ajuda"
        categories={faqCategories}
        faqData={faqData}
        className="pb-10 pt-10 sm:pt-14"
      />
      <p className="mx-auto max-w-3xl px-4 pb-16 text-center text-sm text-white/50">
        Regras de compra, dados e devolução:{" "}
        <Link href="/termos" className="font-semibold text-[#ff9ed2] hover:text-white">
          Termos
        </Link>
        {", "}
        <Link href="/privacidade" className="font-semibold text-[#ff9ed2] hover:text-white">
          Privacidade
        </Link>
        {" e "}
        <Link href="/reembolso" className="font-semibold text-[#ff9ed2] hover:text-white">
          Reembolso
        </Link>
        . Organiza eventos?{" "}
        <Link href="/parceiros#ajuda" className="font-semibold text-[#ff9ed2] hover:text-white">
          Ajuda para parceiros
        </Link>
      </p>
    </main>
  );
}
