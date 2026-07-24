import Link from "next/link";
import { ArrowRight } from "lucide-react";

type SectionTitleProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: { label: string; href: string };
};

export function SectionTitle({ eyebrow, title, description, action }: SectionTitleProps) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="space-y-1.5">
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h2 className="text-2xl font-bold text-white md:text-3xl">{title}</h2>
        {description ? <p className="text-sm text-white/55">{description}</p> : null}
      </div>
      {action ? (
        <Link
          href={action.href}
          className="group inline-flex items-center gap-1.5 text-sm font-semibold text-white/70 transition-colors hover:text-white"
        >
          {action.label}
          <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
        </Link>
      ) : null}
    </div>
  );
}
