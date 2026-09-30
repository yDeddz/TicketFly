import { OrganizerWebhookSettings } from "@/components/organizer-webhook-settings";

export const dynamic = "force-dynamic";

export default function OrganizerWebhooksPage() {
  return (
    <div className="grid gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Webhooks</h1>
        <p className="mt-1 max-w-2xl text-sm text-white/55">
          Receba avisos em tempo real quando uma venda for concluída ou quando seus eventos mudarem de status.
        </p>
      </div>
      <OrganizerWebhookSettings />
    </div>
  );
}
