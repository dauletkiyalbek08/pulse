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

/** Диаграмма РНП: столбцы — лиды по дням, линия — расход $. */
function RnpChart({ rows }: { rows: DailyAdRow[] }) {
  const data = [...rows].sort((a, b) => (a.date < b.date ? -1 : 1));
  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-card bg-surface text-sm text-muted shadow-card ring-1 ring-line">
        Нет данных за период
      </div>
    );
  }

  const W = 800;
  const H = 260;
  const pad = { l: 8, r: 8, t: 16, b: 28 };
  const innerW = W - pad.l - pad.r;
  const innerH = H - pad.t - pad.b;
  const n = data.length;
  const maxLeads = Math.max(...data.map((d) => d.leads), 1) * 1.15;
  const maxSpend = Math.max(...data.map((d) => d.spendUsd), 1) * 1.15;

  const step = innerW / n;
  const barW = Math.min(step * 0.6, 34);
  const xc = (i: number) => pad.l + step * (i + 0.5);
  const yLeads = (v: number) => pad.t + innerH - (v / maxLeads) * innerH;
  const ySpend = (v: number) => pad.t + innerH - (v / maxSpend) * innerH;
  const spendLine = data
    .map((d, i) => `${i === 0 ? "M" : "L"}${xc(i).toFixed(1)} ${ySpend(d.spendUsd).toFixed(1)}`)
    .join(" ");

  const totalLeads = data.reduce((s, d) => s + d.leads, 0);
  const totalSpend = data.reduce((s, d) => s + d.spendUsd, 0);
  const labelEvery = Math.ceil(n / 8);

  return (
    <div className="rounded-card bg-surface p-4 shadow-card ring-1 ring-line">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-64 w-full" role="img" aria-label="Диаграмма РНП">
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

        {/* Столбцы — лиды */}
        {data.map((d, i) => {
          const y = yLeads(d.leads);
          return (
            <rect
              key={d.date}
              x={xc(i) - barW / 2}
              y={y}
              width={barW}
              height={pad.t + innerH - y}
              rx={3}
              fill="#10b981"
              fillOpacity={0.85}
            />
          );
        })}

        {/* Линия — расход */}
        <path d={spendLine} fill="none" stroke="#334155" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {data.map((d, i) => (
          <circle key={d.date} cx={xc(i)} cy={ySpend(d.spendUsd)} r={2.5} fill="#334155" />
        ))}

        {/* Подписи дат по оси X */}
        {data.map((d, i) =>
          i % labelEvery === 0 || i === n - 1 ? (
            <text key={d.date} x={xc(i)} y={H - 8} textAnchor="middle" fontSize="11" fill="#94a3b8">
              {ddmm(d.date)}
            </text>
          ) : null,
        )}
      </svg>

      <div className="mt-2 flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-xs text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-brand" /> Лиды · всего {formatNumber(totalLeads)}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-4 bg-slate-700" /> Расход · всего {formatUsd(totalSpend, 2)}
        </span>
      </div>
    </div>
  );
}
