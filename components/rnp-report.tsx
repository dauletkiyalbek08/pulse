"use client";

import { useState } from "react";
import { BarChart3, Table2 } from "lucide-react";
import { ExportButton } from "@/components/export-button";
import { ReportTable } from "@/components/report-table";
import { formatUsd, formatNumber } from "@/lib/format";
import type { DailyAdRow } from "@/lib/ads-daily";

const ddmm = (d: string) => d.slice(8, 10) + "." + d.slice(5, 7);

/**
 * Ежедневный отчёт по рекламе (РНП) с переключателем «Таблица / Диаграмма».
 * Данные приходят готовыми (server), суммы в долларах.
 */
export function RnpReport({
  rows,
  connected,
  from,
  to,
}: {
  rows: DailyAdRow[];
  connected: boolean;
  from: string;
  to: string;
}) {
  const [view, setView] = useState<"table" | "chart">("table");

  // Итоги
  const t = rows.reduce(
    (s, r) => ({
      spend: s.spend + r.spendUsd,
      imp: s.imp + r.impressions,
      clk: s.clk + r.clicks,
      leads: s.leads + r.leads,
    }),
    { spend: 0, imp: 0, clk: 0, leads: 0 },
  );
  const tCpl = t.leads ? t.spend / t.leads : null;
  const tCpm = t.imp ? (t.spend / t.imp) * 1000 : null;
  const tCpc = t.clk ? t.spend / t.clk : null;
  const tCtr = t.imp ? (t.clk / t.imp) * 100 : null;
  const usd2 = (v: number | null) => (v != null ? formatUsd(v, 2) : "—");

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-ink">Ежедневный отчёт по рекламе (РНП)</h2>
          <p className="mt-0.5 text-xs text-faint">
            По дням из Meta · суммы в долларах ($) · CPM — цена за 1000 показов
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Переключатель вида */}
          <div className="inline-flex rounded-xl border border-line bg-surface p-0.5 shadow-soft">
            <button
              type="button"
              onClick={() => setView("table")}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                view === "table" ? "bg-brand text-white" : "text-muted hover:text-ink"
              }`}
            >
              <Table2 className="h-4 w-4" /> Таблица
            </button>
            <button
              type="button"
              onClick={() => setView("chart")}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                view === "chart" ? "bg-brand text-white" : "text-muted hover:text-ink"
              }`}
            >
              <BarChart3 className="h-4 w-4" /> Диаграмма
            </button>
          </div>
          <ExportButton
            filename={`rnp-${from}_${to}`}
            headers={["Дата", "Расход $", "Показы", "CPM $", "Клики", "CTR %", "CPC $", "Лиды", "CPL $"]}
            rows={rows.map((r) => [
              r.date,
              r.spendUsd.toFixed(2),
              r.impressions,
              r.cpm != null ? r.cpm.toFixed(2) : "",
              r.clicks,
              r.ctr != null ? r.ctr.toFixed(2) : "",
              r.cpc != null ? r.cpc.toFixed(2) : "",
              r.leads,
              r.cpl != null ? r.cpl.toFixed(2) : "",
            ])}
            label="Скачать РНП"
          />
        </div>
      </div>

      {view === "table" ? (
        <ReportTable
          columns={[
            { label: "Дата" },
            { label: "Расход" },
            { label: "Показы" },
            { label: "CPM" },
            { label: "Клики" },
            { label: "CTR" },
            { label: "CPC" },
            { label: "Лиды" },
            { label: "CPL" },
          ]}
          rows={rows.map((r) => [
            r.date.split("-").reverse().join("."),
            usd2(r.spendUsd),
            formatNumber(r.impressions),
            usd2(r.cpm),
            formatNumber(r.clicks),
            r.ctr != null ? `${r.ctr.toFixed(2)}%` : "—",
            usd2(r.cpc),
            formatNumber(r.leads),
            usd2(r.cpl),
          ])}
          total={[
            "Итого",
            usd2(t.spend),
            formatNumber(t.imp),
            usd2(tCpm),
            formatNumber(t.clk),
            tCtr != null ? `${tCtr.toFixed(2)}%` : "—",
            usd2(tCpc),
            formatNumber(t.leads),
            usd2(tCpl),
          ]}
          empty={
            connected
              ? "Нет показов за выбранный период."
              : "Meta-кабинет не подключён — подключите в разделе «Реклама», и отчёт заполнится сам."
          }
        />
      ) : (
        <RnpChart rows={rows} />
      )}
    </div>
  );
}

interface ChartMetric {
  key: keyof Pick<DailyAdRow, "spendUsd" | "leads" | "cpl" | "impressions" | "clicks" | "ctr">;
  label: string;
  rate: boolean; // true — усредняем (CPL, CTR), false — суммируем
  fmt: (v: number) => string;
}

const CHART_METRICS: ChartMetric[] = [
  { key: "spendUsd", label: "Расход, $", rate: false, fmt: (v) => formatUsd(v, 2) },
  { key: "leads", label: "Лиды", rate: false, fmt: (v) => formatNumber(v) },
  { key: "cpl", label: "CPL, $", rate: true, fmt: (v) => formatUsd(v, 2) },
  { key: "impressions", label: "Показы", rate: false, fmt: (v) => formatNumber(v) },
  { key: "clicks", label: "Клики", rate: false, fmt: (v) => formatNumber(v) },
  { key: "ctr", label: "CTR, %", rate: true, fmt: (v) => `${v.toFixed(2)}%` },
];

/** Диаграмма РНП: одна выбранная метрика по дням (столбцы) — понятно и однозначно. */
function RnpChart({ rows }: { rows: DailyAdRow[] }) {
  const [metricKey, setMetricKey] = useState<ChartMetric["key"]>("spendUsd");
  const metric = CHART_METRICS.find((m) => m.key === metricKey) ?? CHART_METRICS[0];
  const data = [...rows].sort((a, b) => (a.date < b.date ? -1 : 1));

  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-card bg-surface text-sm text-muted shadow-card ring-1 ring-line">
        Нет данных за период
      </div>
    );
  }

  const valAt = (d: DailyAdRow) => {
    const v = d[metric.key];
    return typeof v === "number" ? v : 0;
  };

  const W = 800;
  const H = 250;
  const pad = { l: 8, r: 8, t: 14, b: 26 };
  const innerW = W - pad.l - pad.r;
  const innerH = H - pad.t - pad.b;
  const n = data.length;
  const maxV = Math.max(...data.map(valAt), 0);
  const scaleMax = maxV > 0 ? maxV * 1.15 : 1;

  const step = innerW / n;
  const barW = Math.min(step * 0.62, 36);
  const xc = (i: number) => pad.l + step * (i + 0.5);
  const yAt = (v: number) => pad.t + innerH - (v / scaleMax) * innerH;
  const labelEvery = Math.ceil(n / 8);

  // Подпись под диаграммой: сумма или среднее
  const nums = data.map(valAt);
  const sum = nums.reduce((s, v) => s + v, 0);
  const nonZero = data.filter((d) => typeof d[metric.key] === "number").length || 1;
  const caption = metric.rate
    ? `среднее ${metric.fmt(sum / nonZero)}`
    : `всего ${metric.fmt(sum)}`;

  return (
    <div className="rounded-card bg-surface p-4 shadow-card ring-1 ring-line">
      {/* Выбор метрики */}
      <div className="mb-3 flex flex-wrap gap-1.5">
        {CHART_METRICS.map((m) => (
          <button
            key={m.key}
            type="button"
            onClick={() => setMetricKey(m.key)}
            className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
              m.key === metricKey ? "bg-brand text-white" : "bg-canvas text-muted hover:text-ink"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-sm font-semibold text-ink">{metric.label} по дням</span>
        <span className="text-xs text-faint">
          макс {metric.fmt(maxV)} · {caption}
        </span>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="h-60 w-full" role="img" aria-label={`Диаграмма: ${metric.label} по дням`}>
        {[0, 0.5, 1].map((f, i) => (
          <line
            key={i}
            x1={pad.l}
            x2={W - pad.r}
            y1={pad.t + innerH - f * innerH}
            y2={pad.t + innerH - f * innerH}
            stroke="#e9ecf1"
            strokeWidth={1}
          />
        ))}

        {data.map((d, i) => {
          const y = yAt(valAt(d));
          return (
            <rect
              key={d.date}
              x={xc(i) - barW / 2}
              y={y}
              width={barW}
              height={Math.max(pad.t + innerH - y, 0)}
              rx={3}
              fill="#10b981"
              fillOpacity={0.9}
            >
              <title>{`${ddmm(d.date)}: ${metric.fmt(valAt(d))}`}</title>
            </rect>
          );
        })}

        {data.map((d, i) =>
          i % labelEvery === 0 || i === n - 1 ? (
            <text key={d.date} x={xc(i)} y={H - 8} textAnchor="middle" fontSize="11" fill="#94a3b8">
              {ddmm(d.date)}
            </text>
          ) : null,
        )}
      </svg>
    </div>
  );
}
