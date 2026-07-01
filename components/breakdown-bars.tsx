import { formatNumber, formatUsd } from "@/lib/format";
import type { AudienceBucket } from "@/lib/ads-audience";

/**
 * Горизонтальная диаграмма разбивки аудитории.
 * metric="leads" — полоса по лидам (+ цена за лид); metric="clicks" — по кликам
 * (+ цена за клик). Клики нужны для региона: Meta не отдаёт лиды по гео для лид-форм.
 *
 * targetLabels — набор «целевых» групп (напр. возраст 25–54): сверху рисуется
 * шкала «целевая доля %», целевые полосы зелёные, прочие — серые.
 */
export function BreakdownBars({
  title,
  rows,
  metric = "leads",
  max = 10,
  empty = "Нет данных за период",
  targetLabels,
  targetTitle = "Целевая аудитория",
}: {
  title: string;
  rows: AudienceBucket[];
  metric?: "leads" | "clicks";
  max?: number;
  empty?: string;
  targetLabels?: string[];
  targetTitle?: string;
}) {
  const val = (r: AudienceBucket) => (metric === "clicks" ? r.clicks : r.leads);
  const sorted = [...rows].sort((a, b) => val(b) - val(a));
  const top = sorted.slice(0, max);
  const maxVal = Math.max(...top.map(val), 1);

  const targetSet = targetLabels ? new Set(targetLabels) : null;
  const total = rows.reduce((s, r) => s + val(r), 0);
  const targetVal = targetSet
    ? rows.filter((r) => targetSet.has(r.label)).reduce((s, r) => s + val(r), 0)
    : 0;
  const pct = targetSet && total > 0 ? (targetVal / total) * 100 : 0;

  const hasData = top.length > 0 && maxVal > 0;

  return (
    <div className="rounded-card bg-surface p-5 shadow-soft ring-1 ring-line">
      <h3 className="mb-3 text-sm font-semibold text-ink">{title}</h3>

      {/* Шкала целевой доли */}
      {targetSet && hasData && (
        <div className="mb-4 rounded-xl bg-canvas p-3">
          <div className="mb-1.5 flex items-baseline justify-between">
            <span className="text-xs text-muted">{targetTitle}</span>
            <span className="text-lg font-bold text-brand-ink">{pct.toFixed(0)}%</span>
          </div>
          <div className="flex h-2.5 overflow-hidden rounded-full bg-line">
            <div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
          </div>
          <div className="mt-1.5 flex justify-between text-[11px] text-faint">
            <span>Целевые: {formatNumber(targetVal)} лид</span>
            <span>Прочие: {formatNumber(total - targetVal)} лид</span>
          </div>
        </div>
      )}

      {!hasData ? (
        <p className="py-6 text-center text-xs text-muted">{empty}</p>
      ) : (
        <ul className="space-y-2.5">
          {top.map((r) => {
            const isTarget = targetSet ? targetSet.has(r.label) : true;
            return (
              <li key={r.label}>
                <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                  <span className="truncate text-ink">{r.label}</span>
                  <span className="shrink-0 text-muted">
                    {metric === "clicks"
                      ? `${formatNumber(r.clicks)} кликов · ${r.cpc != null ? formatUsd(r.cpc, 2) : "—"}`
                      : `${formatNumber(r.leads)} лид · ${r.cpl != null ? formatUsd(r.cpl, 2) : "—"}`}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-canvas">
                  <div
                    className={`h-full rounded-full ${isTarget ? "bg-brand" : "bg-slate-300"}`}
                    style={{ width: `${Math.max((val(r) / maxVal) * 100, 2)}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
