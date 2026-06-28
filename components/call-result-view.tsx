import type { CallResult } from "@/lib/call-analysis";

function overallTone(s: number): string {
  if (s >= 80) return "text-brand-ink";
  if (s >= 60) return "text-amber-600";
  return "text-red-600";
}
function barColor(s10: number): string {
  if (s10 >= 8) return "bg-brand";
  if (s10 >= 5) return "bg-amber-500";
  return "bg-red-500";
}

/** Презентация разбора звонка: общий балл, критерии, плюсы/минусы/рекомендации. */
export function CallResultView({ result }: { result: CallResult }) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-4">
        <div className={`text-4xl font-bold tracking-tight ${overallTone(result.overall)}`}>
          {result.overall}
          <span className="text-lg font-semibold text-muted">/100</span>
        </div>
        {result.summary && <p className="max-w-xl text-sm text-muted">{result.summary}</p>}
      </div>

      {result.criteria.length > 0 && (
        <div className="space-y-2.5">
          {result.criteria.map((c, i) => (
            <div key={i}>
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-ink">{c.name}</span>
                <span className="tabular-nums text-muted">{c.score}/10</span>
              </div>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-canvas">
                <div className={`h-1.5 rounded-full ${barColor(c.score)}`} style={{ width: `${c.score * 10}%` }} />
              </div>
              {c.comment && <div className="mt-1 text-xs text-muted">{c.comment}</div>}
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Block title="Сильные стороны" tone="text-brand-ink" items={result.strengths} />
        <Block title="Ошибки" tone="text-red-600" items={result.issues} />
        <Block title="Рекомендации" tone="text-ink" items={result.recommendations} />
      </div>
    </div>
  );
}

function Block({ title, tone, items }: { title: string; tone: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="rounded-card bg-canvas p-4">
      <div className={`text-xs font-semibold ${tone}`}>{title}</div>
      <ul className="mt-2 space-y-1 text-sm text-muted">
        {items.map((x, i) => (
          <li key={i}>• {x}</li>
        ))}
      </ul>
    </div>
  );
}
