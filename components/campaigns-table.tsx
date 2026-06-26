import { campaignStatusMeta, objectiveLabel } from "@/lib/ads";
import { formatUsd, formatNumber } from "@/lib/format";

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

const cpl = (spend: number, leads: number) => (leads > 0 ? spend / leads : null);

export function CampaignsTable({
  rows,
  entityLabel = "Кампания",
}: {
  rows: CampaignRow[];
  entityLabel?: string;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-card border border-dashed border-line bg-surface px-6 py-12 text-center text-sm text-muted">
        Данных за выбранный период нет.
      </div>
    );
  }

  const t = rows.reduce(
    (a, c) => ({
      spend: a.spend + Number(c.spend),
      impressions: a.impressions + Number(c.impressions),
      leads: a.leads + Number(c.leads),
    }),
    { spend: 0, impressions: 0, leads: 0 },
  );

  const num = "whitespace-nowrap px-4 py-3 text-right tabular-nums";

  return (
    <div className="overflow-x-auto rounded-card bg-surface shadow-card ring-1 ring-line">
      <table className="w-full min-w-[680px] text-sm">
        <thead>
          <tr className="border-b border-line bg-canvas/60 text-left text-xs font-medium uppercase tracking-wide text-faint">
            <th className="px-4 py-3">{entityLabel}</th>
            <th className="px-4 py-3 text-right">Лиды</th>
            <th className="px-4 py-3 text-right">Цена за лид</th>
            <th className="px-4 py-3 text-right">Потрачено</th>
            <th className="px-4 py-3 text-right">Показы</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => (
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
              <td className={`${num} font-semibold text-ink`}>{c.leads > 0 ? formatNumber(c.leads) : "—"}</td>
              <td className={`${num} text-muted`}>{cpl(c.spend, c.leads) != null ? formatUsd(cpl(c.spend, c.leads)!, 2) : "—"}</td>
              <td className={`${num} font-semibold text-ink`}>{formatUsd(c.spend)}</td>
              <td className={`${num} text-muted`}>{formatNumber(c.impressions)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-line bg-canvas/60 font-semibold text-ink">
            <td className="px-4 py-3">Итого · {formatNumber(rows.length)}</td>
            <td className={num}>{formatNumber(t.leads)}</td>
            <td className={num}>{cpl(t.spend, t.leads) != null ? formatUsd(cpl(t.spend, t.leads)!, 2) : "—"}</td>
            <td className={num}>{formatUsd(t.spend)}</td>
            <td className={num}>{formatNumber(t.impressions)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
