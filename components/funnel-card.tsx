import { formatNumber, formatPercent } from "@/lib/format";

export interface FunnelStage {
  label: string;
  value: number;
}

/** Воронка: бары, пропорциональные первому этапу, + конверсия между этапами. */
export function FunnelCard({ stages }: { stages: FunnelStage[] }) {
  const base = stages[0]?.value || 0;

  return (
    <div className="space-y-4">
      {stages.map((stage, i) => {
        const widthPct = base > 0 ? Math.max((stage.value / base) * 100, 4) : 4;
        const fromPrev =
          i === 0
            ? null
            : stages[i - 1].value > 0
              ? (stage.value / stages[i - 1].value) * 100
              : 0;
        return (
          <div key={stage.label}>
            <div className="mb-1.5 flex items-center justify-between text-sm">
              <span className="text-muted">{stage.label}</span>
              <span className="font-semibold text-ink">
                {formatNumber(stage.value)}
                {fromPrev !== null && (
                  <span className="ml-2 text-xs font-normal text-faint">
                    {formatPercent(fromPrev)}
                  </span>
                )}
              </span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-canvas">
              <div
                className="h-full rounded-full bg-brand"
                style={{ width: `${widthPct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
