import { OrganizerWebhookSettings } from "@/components/organizer-webhook-settings";

export const dynamic = "force-dynamic";

export default function OrganizerWebhooksPage() {
  return (
    <div className="grid gap-6">
      <div>
        <h2 className="text-2xl font-black">Webhooks</h2>
        <p className="mt-1 text-sm text-[#c9aabc]">
          Receba avisos em tempo real quando uma venda for concluída ou quando seus eventos mudarem de status.
        </p>
      </div>
      <OrganizerWebhookSettings />
    </div>
  );
}
