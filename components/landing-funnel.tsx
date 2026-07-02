import { TrendingDown } from "lucide-react";
import type { LandingFunnel as Funnel } from "@/lib/landing-funnel";

/** Воронка лендинга/квиза: полоски по этапам + подсветка самого большого отсева. */
export function LandingFunnelView({ funnel }: { funnel: Funnel }) {
  const { opened, stages, conversion } = funnel;

  if (opened === 0) {
    return (
      <div className="rounded-card border border-line bg-surface p-4 text-sm text-muted">
        Пока нет данных по воронке. Как только по ссылке начнут заходить из рекламы — здесь появятся цифры:
        сколько открыли, где уходят и сколько оставили номер.
      </div>
    );
  }

  // Ищем этап с самым большим относительным отсевом (кроме первого).
  let worstIdx = -1;
  let worstDrop = 0;
  for (let i = 1; i < stages.length; i++) {
    const prev = stages[i - 1].count;
    const drop = prev > 0 ? (prev - stages[i].count) / prev : 0;
    if (drop > worstDrop) {
      worstDrop = drop;
      worstIdx = i;
    }
  }

  return (
    <div className="rounded-card border border-line bg-surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-semibold text-ink">Воронка (30 дней)</span>
        <span className="text-xs text-muted">
          Конверсия в заявку: <b className="text-brand-ink">{conversion.toFixed(1)}%</b>
        </span>
      </div>

      <div className="space-y-1.5">
        {stages.map((s, i) => {
          const pct = opened > 0 ? (s.count / opened) * 100 : 0;
          const isWorst = i === worstIdx && worstDrop >= 0.15;
          return (
            <div key={i} className="flex items-center gap-3">
              <span className="w-32 shrink-0 truncate text-xs text-muted">{s.label}</span>
              <div className="relative h-6 flex-1 overflow-hidden rounded-lg bg-canvas">
                <div
                  className={`h-full rounded-lg ${isWorst ? "bg-amber-400" : "bg-brand"}`}
                  style={{ width: `${Math.max(pct, 2)}%` }}
                />
                <span className="absolute inset-y-0 left-2 flex items-center text-xs font-semibold text-ink">
                  {s.count}
                  <span className="ml-1 font-normal text-muted">· {pct.toFixed(0)}%</span>
                </span>
              </div>
              {isWorst && (
                <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-amber-600">
                  <TrendingDown className="h-3.5 w-3.5" /> уходят
                </span>
              )}
            </div>
          );
        })}
      </div>

      {worstIdx > 0 && worstDrop >= 0.15 && (
        <p className="mt-3 text-xs text-muted">
          Больше всего людей теряется на этапе «<b className="text-ink">{stages[worstIdx].label}</b>» —
          стоит упростить этот шаг или переписать текст.
        </p>
      )}
    </div>
  );
}
