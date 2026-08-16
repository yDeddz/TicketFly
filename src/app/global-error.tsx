"use client";

import { useEffect } from "react";

export default function GlobalError({
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
        source: "global-error-boundary",
        message: error.message,
        digest: error.digest,
        at: new Date().toISOString(),
      }),
    );
  }, [error]);

  return (
    <html lang="pt-BR">
      <body className="bg-[#050505] text-white">
        <main className="mx-auto grid max-w-xl gap-4 px-4 py-16">
          <div className="rounded-2xl border border-[#ff3b6b]/35 bg-[#120410] p-6">
            <h1 className="text-3xl font-black">Falha inesperada</h1>
            <p className="mt-3 text-sm text-white/60">
              Recarregue a página. Se persistir, limpe o cache ou tente em outro navegador.
            </p>
            {error.digest ? (
              <p className="mt-3 font-mono text-xs text-white/35">ref: {error.digest}</p>
            ) : null}
            <button
              type="button"
              onClick={reset}
              className="mt-6 cursor-pointer rounded-full bg-[#ff1493] px-4 py-3 text-sm font-bold text-white"
            >
              Recarregar
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
