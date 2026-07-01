import { formatNumber, formatUsd } from "@/lib/format";
import type { AudienceBucket } from "@/lib/ads-audience";

/**
 * Горизонтальная диаграмма разбивки аудитории (лиды по группам).
 * Ширина полосы ∝ числу лидов; справа — лиды и цена за лид ($).
 */
export function BreakdownBars({
  title,
  rows,
  max = 10,
  empty = "Нет данных за период",
}: {
  title: string;
  rows: AudienceBucket[];
  max?: number;
  empty?: string;
}) {
  const top = rows.slice(0, max);
  const maxLeads = Math.max(...top.map((r) => r.leads), 1);

  return (
    <div className="rounded-card bg-surface p-5 shadow-soft ring-1 ring-line">
      <h3 className="mb-3 text-sm font-semibold text-ink">{title}</h3>
      {top.length === 0 ? (
        <p className="py-6 text-center text-xs text-muted">{empty}</p>
      ) : (
        <ul className="space-y-2.5">
          {top.map((r) => (
            <li key={r.label}>
              <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                <span className="truncate text-ink">{r.label}</span>
                <span className="shrink-0 text-muted">
                  {formatNumber(r.leads)} лид · {r.cpl != null ? formatUsd(r.cpl, 2) : "—"}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-canvas">
                <div
                  className="h-full rounded-full bg-brand"
                  style={{ width: `${Math.max((r.leads / maxLeads) * 100, 2)}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
