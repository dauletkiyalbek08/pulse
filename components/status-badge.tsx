import type { StatusTone } from "@/lib/projects";

const TONE_CLASS: Record<StatusTone, string> = {
  active: "bg-status-active-soft text-status-active",
  paused: "bg-status-paused-soft text-status-paused",
  done: "bg-status-done-soft text-status-done",
};

export function StatusBadge({ tone, label }: { tone: StatusTone; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${TONE_CLASS[tone]}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}
