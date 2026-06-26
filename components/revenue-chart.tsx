import { formatCurrencyShort, formatDate } from "@/lib/format";

export interface ChartPoint {
  date: string;
  revenue: number;
  adSpend: number;
}

/**
 * Лёгкий SVG-график «Динамика дохода» (без зависимостей).
 * Площадь — доход, пунктир — расходы на рекламу.
 */
export function RevenueChart({ data }: { data: ChartPoint[] }) {
  if (data.length === 0) {
    return (
      <div className="flex h-56 items-center justify-center text-sm text-muted">
        Нет данных за период
      </div>
    );
  }

  const W = 800;
  const H = 240;
  const pad = { l: 10, r: 10, t: 16, b: 28 };
  const innerW = W - pad.l - pad.r;
  const innerH = H - pad.t - pad.b;
  const n = data.length;

  const maxV =
    Math.max(...data.map((d) => Math.max(d.revenue, d.adSpend)), 1) * 1.12;

  const xAt = (i: number) => pad.l + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const yAt = (v: number) => pad.t + innerH - (v / maxV) * innerH;

  const toPath = (pick: (p: ChartPoint) => number) =>
    data
      .map((d, i) => `${i === 0 ? "M" : "L"}${xAt(i).toFixed(1)} ${yAt(pick(d)).toFixed(1)}`)
      .join(" ");

  const revenueLine = toPath((d) => d.revenue);
  const spendLine = toPath((d) => d.adSpend);
  const area = `${revenueLine} L${xAt(n - 1).toFixed(1)} ${pad.t + innerH} L${xAt(0).toFixed(1)} ${pad.t + innerH} Z`;

  // Горизонтальные подписи по оси Y (0, середина, максимум)
  const yTicks = [0, maxV / 2, maxV];

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-56 w-full"
        preserveAspectRatio="none"
        role="img"
        aria-label="График динамики дохода"
      >
        <defs>
          <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
          </linearGradient>
        </defs>

        {yTicks.map((t, i) => (
          <line
            key={i}
            x1={pad.l}
            x2={W - pad.r}
            y1={yAt(t)}
            y2={yAt(t)}
            stroke="#e9ecf1"
            strokeWidth={1}
          />
        ))}

        <path d={area} fill="url(#revFill)" />
        <path
          d={spendLine}
          fill="none"
          stroke="#94a3b8"
          strokeWidth={1.5}
          strokeDasharray="4 4"
        />
        <path
          d={revenueLine}
          fill="none"
          stroke="#10b981"
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>

      <div className="mt-2 flex items-center justify-between text-xs text-muted">
        <span>{formatDate(data[0].date)}</span>
        <div className="flex items-center gap-4">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-brand" /> Доход
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-3 bg-faint" /> Расход
          </span>
          <span className="text-faint">макс {formatCurrencyShort(maxV)}</span>
        </div>
        <span>{formatDate(data[n - 1].date)}</span>
      </div>
    </div>
  );
}
