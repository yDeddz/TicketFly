"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * If Supabase falls back to Site URL with an implicit recovery hash,
 * send the user to the password form instead of leaving them on home.
 */
export function AuthRecoveryRedirect() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (pathname === "/redefinir-senha" || pathname.startsWith("/auth/")) {
      return;
    }

    const hash = window.location.hash.startsWith("#")
      ? window.location.hash.slice(1)
      : window.location.hash;
    if (!hash) return;

    const params = new URLSearchParams(hash);
    if (params.get("type") === "recovery" && params.get("access_token")) {
      router.replace(`/redefinir-senha#${hash}`);
    }
  }, [pathname, router]);

  return null;
}
