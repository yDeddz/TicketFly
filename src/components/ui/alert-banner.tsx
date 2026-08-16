import clsx from "clsx";

type Tone = "error" | "success" | "warning" | "info";

const tones: Record<Tone, string> = {
  error: "border-[#ff3b6b]/40 bg-[#2a050d] text-[#ff9aae]",
  success: "border-[#25d47a]/40 bg-[#062417] text-[#8fffc1]",
  warning: "border-[#f5a524]/40 bg-[#261802] text-[#ffd27a]",
  info: "border-[#ff1493]/25 bg-[#ff1493]/10 text-[#ffb1d5]",
};

export function AlertBanner({
  children,
  tone = "info",
  className,
  role = "alert",
}: {
  children: React.ReactNode;
  tone?: Tone;
  className?: string;
  role?: "alert" | "status";
}) {
  return (
    <p role={role} className={clsx("rounded-xl border px-4 py-3 text-sm", tones[tone], className)}>
      {children}
    </p>
  );
}
