"use client";

import { BadgeCheck, ShieldCheck, Ticket, Zap } from "lucide-react";

import { GlowingEffect } from "@/components/ui/glowing-effect";
import { cn } from "@/lib/utils";

const features = [
  {
    icon: Ticket,
    title: "Ingresso digital",
    description: "QR Code único, direto no seu celular.",
  },
  {
    icon: ShieldCheck,
    title: "Pagamento seguro",
    description: "Pix e cartão com checkout protegido.",
  },
  {
    icon: Zap,
    title: "Compra em segundos",
    description: "Escolha o lote e finalize sem atrito.",
  },
  {
    icon: BadgeCheck,
    title: "Entrada garantida",
    description: "Ingresso válido com confirmação na hora.",
  },
] as const;

export function FeatureGlowCards() {
  return (
    <ul className="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-4">
      {features.map((feature) => (
        <GridItem
          key={feature.title}
          icon={<feature.icon className="h-5 w-5" strokeWidth={2} />}
          title={feature.title}
          description={feature.description}
        />
      ))}
    </ul>
  );
}

interface GridItemProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

function GridItem({ icon, title, description }: GridItemProps) {
  return (
    <li className="list-none">
      <div className="relative h-full rounded-[1.25rem] border border-white/[0.08] p-2 md:rounded-[1.5rem] md:p-2.5">
        <GlowingEffect
          spread={40}
          glow
          disabled={false}
          proximity={64}
          inactiveZone={0.01}
          borderWidth={2}
        />
        <div
          className={cn(
            "relative flex h-full flex-col gap-4 overflow-hidden rounded-xl border border-white/[0.06]",
            "bg-[#0c0c0c] p-5 shadow-[0_0_27px_0_rgba(0,0,0,0.45)] sm:gap-5 sm:p-6",
          )}
        >
          <div className="grid h-11 w-11 place-items-center rounded-full bg-[#ff1493]/12 text-[#ff9ed2] shadow-[0_0_24px_-4px_rgba(255,20,147,0.55)]">
            {icon}
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-semibold tracking-tight text-white sm:text-xl">{title}</h3>
            <p className="text-sm leading-relaxed text-white/55 sm:text-[0.95rem] sm:leading-6">
              {description}
            </p>
          </div>
        </div>
      </div>
    </li>
  );
}
