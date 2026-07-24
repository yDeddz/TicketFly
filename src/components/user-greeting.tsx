import Link from "next/link";
import { Plus } from "lucide-react";

type UserGreetingProps = {
  name: string;
  activeCount: number;
};

export function UserGreeting({ name, activeCount }: UserGreetingProps) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-5">
      <div className="space-y-2">
        <p className="eyebrow">Carteira digital</p>
        <h1 className="text-3xl font-bold text-white md:text-4xl">
          Olá, {name} <span className="inline-block">👋</span>
        </h1>
        <p className="max-w-md text-white/60">
          Você possui{" "}
          <span className="font-semibold text-white">
            {activeCount} {activeCount === 1 ? "ingresso ativo" : "ingressos ativos"}
          </span>
          . Todos prontos para uso.
        </p>
      </div>
      <Link href="/eventos" className="neon-button btn h-12 px-6 text-sm">
        <Plus className="h-4 w-4" aria-hidden />
        Comprar novos
      </Link>
    </div>
  );
}
