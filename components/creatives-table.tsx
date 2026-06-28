import type { PillTone } from "@/lib/leads";
import { Pill } from "@/components/pill";
import { campaignStatusMeta } from "@/lib/ads";
import { formatCurrency, formatNumber } from "@/lib/format";

export type CreativeVerdict = "top" | "ok" | "weak";

export interface CreativeRow {
  id: string;
  name: string;
  status: string;
  spendKzt: number;
  crmLeads: number;
  buyers: number;
  revenue: number;
  cpl: number | null; // цена лида, ₸
  verdict: CreativeVerdict;
  verdictHint: string; // короткое пояснение оценки
}

const roasText = (roas: number) => `${roas.toFixed(1).replace(".", ",")}x`;

/** Тон ROAS: ≥2 хорошо, ≥1 окупается, <1 в минус. */
function roasTone(roas: number): PillTone {
  if (roas >= 2) return "success";
  if (roas >= 1) return "warning";
  return "danger";
}

export const VERDICT_META: Record<CreativeVerdict, { label: string; tone: PillTone }> = {
  top: { label: "Топ", tone: "success" },
  ok: { label: "Норм", tone: "info" },
  weak: { label: "Слабый", tone: "danger" },
};

const roas = (revenue: number, spend: number) => (spend > 0 ? revenue / spend : null);

/**
 * Таблица «креатив → лиды → продажи → ROAS» с оценкой каждого объявления.
 * Расход уже в тенге (сконвертирован по курсу проекта), выручка — из CRM.
 */
export function CreativesTable({ rows }: { rows: CreativeRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-card border border-dashed border-line bg-surface px-6 py-12 text-center text-sm text-muted">
        Нет объявлений с данными за выбранный период.
      </div>
    );
  }

  const t = rows.reduce(
    (a, r) => ({
      spendKzt: a.spendKzt + r.spendKzt,
      crmLeads: a.crmLeads + r.crmLeads,
      buyers: a.buyers + r.buyers,
      revenue: a.revenue + r.revenue,
    }),
    { spendKzt: 0, crmLeads: 0, buyers: 0, revenue: 0 },
  );

  const num = "whitespace-nowrap px-4 py-3 text-right tabular-nums";
  const totalCpl = t.crmLeads > 0 ? t.spendKzt / t.crmLeads : null;
  const totalRoas = roas(t.revenue, t.spendKzt);

  return (
    <div className="overflow-x-auto rounded-card bg-surface shadow-card ring-1 ring-line">
      <table className="w-full min-w-[860px] text-sm">
        <thead>
          <tr className="border-b border-line bg-canvas/60 text-left text-xs font-medium uppercase tracking-wide text-faint">
            <th className="px-4 py-3">Объявление</th>
            <th className="px-4 py-3 text-right">Лиды</th>
            <th className="px-4 py-3 text-right">Цена лида</th>
            <th className="px-4 py-3 text-right">Продажи</th>
            <th className="px-4 py-3 text-right">Выручка</th>
            <th className="px-4 py-3 text-right">Расход</th>
            <th className="px-4 py-3 text-right">ROAS</th>
            <th className="px-4 py-3 text-right">Оценка</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const ro = roas(r.revenue, r.spendKzt);
            const sm = campaignStatusMeta(r.status);
            const v = VERDICT_META[r.verdict];
            return (
              <tr key={r.id} className="border-b border-line last:border-0 transition hover:bg-canvas">
                <td className="px-4 py-3">
                  <div className="flex flex-col items-start gap-1">
                    <span className="font-medium text-ink">{r.name}</span>
                    <Pill tone={sm.tone}>{sm.label}</Pill>
                  </div>
                </td>
                <td className={`${num} font-semibold text-ink`}>{r.crmLeads > 0 ? formatNumber(r.crmLeads) : "—"}</td>
                <td className={`${num} text-muted`}>{r.cpl != null ? formatCurrency(r.cpl) : "—"}</td>
                <td className={`${num} font-semibold text-ink`}>{r.buyers > 0 ? formatNumber(r.buyers) : "—"}</td>
                <td className={`${num} font-semibold text-ink`}>{r.revenue > 0 ? formatCurrency(r.revenue) : "—"}</td>
                <td className={`${num} text-muted`}>{r.spendKzt > 0 ? formatCurrency(r.spendKzt) : "—"}</td>
                <td className={num}>
                  {ro != null ? <Pill tone={roasTone(ro)}>{roasText(ro)}</Pill> : <span className="text-faint">—</span>}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right">
                  <div className="flex flex-col items-end gap-1">
                    <Pill tone={v.tone}>{v.label}</Pill>
                    <span className="text-[11px] leading-tight text-faint">{r.verdictHint}</span>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-line bg-canvas/60 font-semibold text-ink">
            <td className="px-4 py-3">Итого · {formatNumber(rows.length)}</td>
            <td className={num}>{formatNumber(t.crmLeads)}</td>
            <td className={num}>{totalCpl != null ? formatCurrency(totalCpl) : "—"}</td>
            <td className={num}>{formatNumber(t.buyers)}</td>
            <td className={num}>{formatCurrency(t.revenue)}</td>
            <td className={num}>{formatCurrency(t.spendKzt)}</td>
            <td className={num}>{totalRoas != null ? roasText(totalRoas) : "—"}</td>
            <td className={num}>—</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
