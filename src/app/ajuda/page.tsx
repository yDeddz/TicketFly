import type { Metadata } from "next";

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
        className="pb-20 pt-10 sm:pt-14"
      />
    </main>
  );
}
