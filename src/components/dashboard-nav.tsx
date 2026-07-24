"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

export type DashboardNavItem = {
  href: string;
  label: string;
};

export function DashboardNav({ items, base }: { items: DashboardNavItem[]; base: string }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap gap-2">
      {items.map((item) => {
        const active = item.href === base ? pathname === item.href : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={clsx(
              "cursor-pointer rounded-full border px-4 py-2 text-sm font-bold transition-colors duration-200",
              active
                ? "border-[#ff1493]/50 bg-[#ff1493]/15 text-white"
                : "border-white/10 bg-white/[0.03] text-white/65 hover:border-[#ff1493]/35 hover:text-white",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
