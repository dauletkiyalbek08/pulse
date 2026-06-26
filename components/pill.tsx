import type { PillTone } from "@/lib/leads";

const TONE_CLASS: Record<PillTone, string> = {
  neutral: "bg-canvas text-muted",
  info: "bg-blue-50 text-blue-600",
  warning: "bg-amber-50 text-amber-600",
  violet: "bg-violet-50 text-violet-600",
  success: "bg-brand-soft text-brand-ink",
};

export function Pill({
  tone,
  children,
}: {
  tone: PillTone;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${TONE_CLASS[tone]}`}
    >
      {children}
    </span>
  );
}
