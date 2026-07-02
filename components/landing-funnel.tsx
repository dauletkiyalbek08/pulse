import { LogOut } from "lucide-react";
import type { LandingFunnel as Funnel } from "@/lib/landing-funnel";

/** Воронка лендинга/квиза: полоски по этапам + где именно люди выходят. */
export function LandingFunnelView({ funnel, rangeLabel }: { funnel: Funnel; rangeLabel: string }) {
  const { opened, stages, conversion, worstIdx } = funnel;

  if (opened === 0) {
    return (
      <div className="rounded-card border border-line bg-surface p-4 text-sm text-muted">
        За «{rangeLabel}» заходов не было. Как только по ссылке начнут переходить из рекламы — здесь
        появится воронка: сколько открыли, с какого вопроса выходят и сколько оставили номер.
      </div>
    );
  }

  const worst = worstIdx >= 0 ? stages[worstIdx] : null;

  return (
    <div className="rounded-card border border-line bg-surface p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-semibold text-ink">Воронка · {rangeLabel}</span>
        <span className="text-xs text-muted">
          Конверсия в заявку: <b className="text-brand-ink">{conversion.toFixed(1)}%</b>
        </span>
      </div>

      <div className="space-y-1.5">
        {stages.map((s, i) => {
          const pct = opened > 0 ? (s.count / opened) * 100 : 0;
          const isWorst = i === worstIdx;
          return (
            <div key={i} className="flex items-center gap-2">
              <span className="w-28 shrink-0 truncate text-xs text-muted" title={s.label}>
                {s.label}
              </span>
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
              {/* Сколько ушли именно на этом этапе */}
              <span
                className={`w-20 shrink-0 text-right text-xs ${
                  isWorst ? "font-semibold text-amber-600" : "text-faint"
                }`}
              >
                {s.exited > 0 ? (
                  <span className="inline-flex items-center gap-1">
                    <LogOut className="h-3 w-3" />
                    {s.exited}
                  </span>
                ) : (
                  ""
                )}
              </span>
            </div>
          );
        })}
      </div>

      <p className="mt-3 text-xs text-muted">
        Колонка справа (<LogOut className="inline h-3 w-3" />) — сколько человек вышли <b>именно на этом
        шаге</b>, не дойдя до следующего.
        {worst && worst.exited > 0 && (
          <>
            {" "}
            Больше всего теряется на «<b className="text-ink">{worst.label}</b>»: {worst.exited} чел. —
            стоит упростить этот шаг или переписать текст.
          </>
        )}
      </p>
    </div>
  );
}
