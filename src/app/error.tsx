"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(
      JSON.stringify({
        level: "error",
        source: "app-error-boundary",
        message: error.message,
        digest: error.digest,
        at: new Date().toISOString(),
      }),
    );
  }, [error]);

  return (
    <main className="mx-auto grid max-w-xl gap-4 px-4 pb-16 pt-12">
      <div className="rounded-2xl border border-[#ff3b6b]/35 bg-[#120410] p-6">
        <p className="text-xs font-black uppercase tracking-wide text-[#ff6b8a]">Algo deu errado</p>
        <h1 className="mt-2 text-3xl font-black text-white">Não foi possível carregar esta página</h1>
        <p className="mt-3 text-sm text-white/60">
          Tente novamente. Se o problema continuar, volte aos eventos ou fale com o suporte.
        </p>
        {error.digest ? (
          <p className="mt-3 font-mono text-xs text-white/35">ref: {error.digest}</p>
        ) : null}
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={reset}
            className="cursor-pointer rounded-full bg-[#ff1493] px-4 py-3 text-sm font-bold text-white"
          >
            Tentar de novo
          </button>
          <Link
            href="/eventos"
            className="rounded-full border border-white/15 px-4 py-3 text-sm font-bold text-white/75"
          >
            Ver eventos
          </Link>
        </div>
      </div>
    </main>
  );
}
