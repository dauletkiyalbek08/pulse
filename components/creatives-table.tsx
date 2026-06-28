import type { PillTone } from "@/lib/leads";
import { Pill } from "@/components/pill";
import { campaignStatusMeta } from "@/lib/ads";
import { formatCurrency, formatNumber, formatUsd } from "@/lib/format";

export type CreativeVerdict = "top" | "ok" | "weak";

export interface CreativeRow {
  id: string;
  name: string;
  status: string;
  thumb: string | null; // миниатюра креатива
  full: string | null; // ссылка на полную картинку (для «посмотреть»)
  spendUsd: number; // расход $
  spendKzt: number; // расход ₸ (для итогового ROAS)
  leads: number; // лиды по данным Meta
  buyers: number; // покупатели (CRM, по ad_id лида)
  revenue: number; // выручка ₸ (CRM)
  cplUsd: number | null; // цена лида $
  roas: number | null; // выручка ₸ / расход ₸
  verdict: CreativeVerdict;
  verdictHint: string;
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

/** Квадратная миниатюра креатива (клик — открыть полную в новой вкладке). */
function Thumb({ thumb, full, name }: { thumb: string | null; full: string | null; name: string }) {
  if (!thumb) {
    return <div className="h-11 w-11 shrink-0 rounded-lg bg-canvas ring-1 ring-line" aria-hidden />;
  }
  const img = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={thumb}
      alt={name}
      className="h-11 w-11 shrink-0 rounded-lg object-cover ring-1 ring-line"
      loading="lazy"
    />
  );
  return full ? (
    <a href={full} target="_blank" rel="noopener noreferrer" title="Открыть креатив" className="shrink-0">
      {img}
    </a>
  ) : (
    img
  );
}

/**
 * Таблица «креатив → лиды → продажи → ROAS» с оценкой и превью объявления.
 * Расход и цена лида — в долларах (валюта кабинета), выручка — в тенге.
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
      spendUsd: a.spendUsd + r.spendUsd,
      spendKzt: a.spendKzt + r.spendKzt,
      leads: a.leads + r.leads,
      buyers: a.buyers + r.buyers,
      revenue: a.revenue + r.revenue,
    }),
    { spendUsd: 0, spendKzt: 0, leads: 0, buyers: 0, revenue: 0 },
  );

  const num = "whitespace-nowrap px-4 py-3 text-right tabular-nums";
  const totalCplUsd = t.leads > 0 ? t.spendUsd / t.leads : null;
  const totalRoas = t.spendKzt > 0 ? t.revenue / t.spendKzt : null;

  return (
    <div className="overflow-x-auto rounded-card bg-surface shadow-card ring-1 ring-line">
      <table className="w-full min-w-[900px] text-sm">
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
            const sm = campaignStatusMeta(r.status);
            const v = VERDICT_META[r.verdict];
            return (
              <tr key={r.id} className="border-b border-line last:border-0 transition hover:bg-canvas">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Thumb thumb={r.thumb} full={r.full} name={r.name} />
                    <div className="flex flex-col items-start gap-1">
                      <span className="font-medium text-ink">{r.name}</span>
                      <Pill tone={sm.tone}>{sm.label}</Pill>
                    </div>
                  </div>
                </td>
                <td className={`${num} font-semibold text-ink`}>{r.leads > 0 ? formatNumber(r.leads) : "—"}</td>
                <td className={`${num} text-muted`}>{r.cplUsd != null ? formatUsd(r.cplUsd, 2) : "—"}</td>
                <td className={`${num} font-semibold text-ink`}>{r.buyers > 0 ? formatNumber(r.buyers) : "—"}</td>
                <td className={`${num} font-semibold text-ink`}>{r.revenue > 0 ? formatCurrency(r.revenue) : "—"}</td>
                <td className={`${num} text-muted`}>{r.spendUsd > 0 ? formatUsd(r.spendUsd, 2) : "—"}</td>
                <td className={num}>
                  {r.roas != null ? <Pill tone={roasTone(r.roas)}>{roasText(r.roas)}</Pill> : <span className="text-faint">—</span>}
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
            <td className={num}>{formatNumber(t.leads)}</td>
            <td className={num}>{totalCplUsd != null ? formatUsd(totalCplUsd, 2) : "—"}</td>
            <td className={num}>{formatNumber(t.buyers)}</td>
            <td className={num}>{formatCurrency(t.revenue)}</td>
            <td className={num}>{formatUsd(t.spendUsd, 2)}</td>
            <td className={num}>{totalRoas != null ? roasText(totalRoas) : "—"}</td>
            <td className={num}>—</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
