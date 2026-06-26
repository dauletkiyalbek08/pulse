import { campaignStatusMeta, objectiveLabel } from "@/lib/ads";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/format";

export interface CampaignRow {
  id: string;
  name: string;
  objective: string;
  status: string;
  spend: number;
  impressions: number;
  clicks: number;
  reach: number;
  leads: number;
}

/** Тумблер «вкл/выкл» как в Ads Manager (только индикатор статуса). */
function StatusToggle({ status }: { status: string }) {
  const on = status === "active";
  const meta = campaignStatusMeta(status);
  return (
    <div className="flex items-center gap-2">
      <span
        className={`relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition ${
          on ? "bg-brand" : "bg-line"
        }`}
      >
        <span
          className={`inline-block h-3 w-3 rounded-full bg-white shadow transition ${
            on ? "translate-x-3.5" : "translate-x-0.5"
          }`}
        />
      </span>
      <span className={`text-xs ${on ? "text-brand-ink" : "text-faint"}`}>{meta.label}</span>
    </div>
  );
}

export function CampaignsTable({ rows }: { rows: CampaignRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-card border border-dashed border-line bg-surface px-6 py-12 text-center text-sm text-muted">
        Кампании появятся после подключения и синхронизации Meta Ads.
      </div>
    );
  }

  const t = rows.reduce(
    (a, c) => ({
      spend: a.spend + Number(c.spend),
      impressions: a.impressions + Number(c.impressions),
      clicks: a.clicks + Number(c.clicks),
      reach: a.reach + Number(c.reach),
      leads: a.leads + Number(c.leads),
    }),
    { spend: 0, impressions: 0, clicks: 0, reach: 0, leads: 0 },
  );
  const totalCtr = t.impressions > 0 ? (t.clicks / t.impressions) * 100 : 0;
  const totalCpl = t.leads > 0 ? t.spend / t.leads : null;

  const num = "whitespace-nowrap px-4 py-3 text-right tabular-nums";

  return (
    <div className="overflow-x-auto rounded-card bg-surface shadow-card ring-1 ring-line">
      <table className="w-full min-w-[920px] text-sm">
        <thead>
          <tr className="border-b border-line bg-canvas/60 text-left text-xs font-medium uppercase tracking-wide text-faint">
            <th className="px-4 py-3">Кампания</th>
            <th className="px-4 py-3 text-right">Результаты</th>
            <th className="px-4 py-3 text-right">Охват</th>
            <th className="px-4 py-3 text-right">Показы</th>
            <th className="px-4 py-3 text-right">Клики</th>
            <th className="px-4 py-3 text-right">CTR</th>
            <th className="px-4 py-3 text-right">Цена за результат</th>
            <th className="px-4 py-3 text-right">Потрачено</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => {
            const ctr = c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0;
            const cpl = c.leads > 0 ? c.spend / c.leads : null;
            return (
              <tr key={c.id} className="border-b border-line last:border-0 transition hover:bg-canvas">
                <td className="px-4 py-3">
                  <div className="flex flex-col gap-1">
                    <span className="font-medium text-ink">{c.name}</span>
                    <div className="flex items-center gap-2">
                      <StatusToggle status={c.status} />
                      <span className="text-faint">·</span>
                      <span className="text-xs text-muted">{objectiveLabel(c.objective)}</span>
                    </div>
                  </div>
                </td>
                <td className={`${num} font-semibold text-ink`}>
                  {c.leads > 0 ? formatNumber(c.leads) : "—"}
                  <div className="text-[11px] font-normal text-faint">лиды</div>
                </td>
                <td className={`${num} text-muted`}>{formatNumber(c.reach)}</td>
                <td className={`${num} text-muted`}>{formatNumber(c.impressions)}</td>
                <td className={`${num} text-muted`}>{formatNumber(c.clicks)}</td>
                <td className={`${num} text-muted`}>{formatPercent(ctr)}</td>
                <td className={`${num} text-muted`}>{cpl != null ? formatCurrency(cpl) : "—"}</td>
                <td className={`${num} font-semibold text-ink`}>{formatCurrency(c.spend)}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-line bg-canvas/60 font-semibold text-ink">
            <td className="px-4 py-3">Итого по {formatNumber(rows.length)} кампаниям</td>
            <td className={num}>{formatNumber(t.leads)}</td>
            <td className={num}>{formatNumber(t.reach)}</td>
            <td className={num}>{formatNumber(t.impressions)}</td>
            <td className={num}>{formatNumber(t.clicks)}</td>
            <td className={num}>{formatPercent(totalCtr)}</td>
            <td className={num}>{totalCpl != null ? formatCurrency(totalCpl) : "—"}</td>
            <td className={num}>{formatCurrency(t.spend)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
