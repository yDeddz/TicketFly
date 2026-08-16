import Link from "next/link";
import { Check, Circle } from "lucide-react";

export type OpsSetupItem = {
  label: string;
  done: boolean;
  href: string;
  hint?: string;
};

export function OpsSetupList({
  title,
  description,
  items,
}: {
  title: string;
  description?: string;
  items: OpsSetupItem[];
}) {
  const pending = items.filter((item) => !item.done).length;

  return (
    <section className="rounded-2xl border border-[#ff1493]/25 bg-[#120410] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-black">{title}</h2>
          {description ? <p className="mt-1 text-sm text-[#c9aabc]">{description}</p> : null}
        </div>
        <span className="rounded-full border border-white/10 px-3 py-1 text-xs font-bold uppercase text-white/70">
          {pending === 0 ? "Pronto para operar" : `${pending} pendente(s)`}
        </span>
      </div>
      <ol className="mt-4 grid gap-2">
        {items.map((item) => (
          <li key={item.label}>
            <Link
              href={item.href}
              className="flex items-start gap-3 rounded-xl border border-white/8 bg-black/20 px-3 py-3 transition hover:border-[#ff1493]/35"
            >
              {item.done ? (
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
              ) : (
                <Circle className="mt-0.5 h-4 w-4 shrink-0 text-white/35" />
              )}
              <span>
                <span className={`block text-sm font-bold ${item.done ? "text-white/70" : "text-white"}`}>
                  {item.label}
                </span>
                {item.hint ? <span className="mt-0.5 block text-xs text-white/45">{item.hint}</span> : null}
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
