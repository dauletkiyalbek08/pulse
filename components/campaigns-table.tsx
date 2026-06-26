import { Pill } from "@/components/pill";
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

export function CampaignsTable({ rows }: { rows: CampaignRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-card border border-dashed border-line bg-surface px-6 py-12 text-center text-sm text-muted">
        Кампании появятся после подключения и синхронизации Meta Ads.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-card bg-surface shadow-soft ring-1 ring-line">
      <table className="w-full min-w-[860px] text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-faint">
            <th className="px-4 py-3 font-medium">Кампания</th>
            <th className="px-4 py-3 font-medium">Статус</th>
            <th className="px-4 py-3 text-right font-medium">Показы</th>
            <th className="px-4 py-3 text-right font-medium">Клики</th>
            <th className="px-4 py-3 text-right font-medium">CTR</th>
            <th className="px-4 py-3 text-right font-medium">Охват</th>
            <th className="px-4 py-3 text-right font-medium">Лиды</th>
            <th className="px-4 py-3 text-right font-medium">Цена лида</th>
            <th className="px-4 py-3 text-right font-medium">Расход</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => {
            const ctr = c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0;
            const cpl = c.leads > 0 ? c.spend / c.leads : null;
            const st = campaignStatusMeta(c.status);
            return (
              <tr key={c.id} className="border-b border-line last:border-0 transition hover:bg-canvas">
                <td className="px-4 py-3">
                  <div className="font-medium text-ink">{c.name}</div>
                  <div className="mt-0.5">
                    <Pill tone={c.objective === "vacancy" ? "info" : "success"}>
                      {objectiveLabel(c.objective)}
                    </Pill>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <Pill tone={st.tone}>{st.label}</Pill>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right text-muted">{formatNumber(c.impressions)}</td>
                <td className="whitespace-nowrap px-4 py-3 text-right text-muted">{formatNumber(c.clicks)}</td>
                <td className="whitespace-nowrap px-4 py-3 text-right text-muted">{formatPercent(ctr)}</td>
                <td className="whitespace-nowrap px-4 py-3 text-right text-muted">{formatNumber(c.reach)}</td>
                <td className="whitespace-nowrap px-4 py-3 text-right font-medium text-ink">
                  {c.leads > 0 ? formatNumber(c.leads) : "—"}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right text-muted">
                  {cpl != null ? formatCurrency(cpl) : "—"}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-ink">
                  {formatCurrency(c.spend)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
