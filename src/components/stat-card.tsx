export function StatCard({
  label,
  value,
  tone = "dark",
}: {
  label: string;
  value: string;
  tone?: "dark" | "pink" | "light";
}) {
  const className =
    tone === "pink"
      ? "border border-[#ff1493]/50 bg-[#ff1493] text-white shadow-[0_0_34px_rgba(255,20,147,0.28)]"
      : tone === "dark"
        ? "border border-white/10 bg-[#111014] text-white"
        : "border border-[#ff1493]/25 bg-[#160913] text-[#fff2fa]";

  return (
    <div className={`rounded-lg p-5 shadow-[0_18px_60px_rgba(0,0,0,0.28)] ${className}`}>
      <p className="text-sm font-semibold opacity-70">{label}</p>
      <strong className="mt-2 block text-3xl font-black">{value}</strong>
    </div>
  );
}
