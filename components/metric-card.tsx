import type { LucideIcon } from "lucide-react";

interface MetricCardProps {
  label: string;
  value: string;
  hint?: string;
  icon?: LucideIcon;
  /** Подсветить значение акцентом (например, чистая прибыль). */
  accent?: boolean;
}

export function MetricCard({
  label,
  value,
  hint,
  icon: Icon,
  accent,
}: MetricCardProps) {
  return (
    <div className="rounded-card bg-surface p-5 shadow-soft ring-1 ring-line">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted">{label}</span>
        {Icon && (
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-canvas text-faint">
            <Icon className="h-4 w-4" />
          </span>
        )}
      </div>
      <div
        className={`mt-3 text-2xl font-bold tracking-tight ${
          accent ? "text-brand-ink" : "text-ink"
        }`}
      >
        {value}
      </div>
      {hint && <div className="mt-1 text-xs text-muted">{hint}</div>}
    </div>
  );
}
