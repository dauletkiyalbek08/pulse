import type { Tables } from "@/lib/database.types";

/**
 * Единственное место расчёта производных метрик (ТЗ, разделы 5 и 11).
 * UI и дашборды берут цифры отсюда, а не считают по компонентам.
 */

export type DailyMetric = Tables<"metrics_daily">;

export interface DerivedMetrics {
  revenue: number; // Доход / Выручка
  adSpend: number; // Расходы (реклама)
  netProfit: number; // Чистая прибыль = revenue - ad_spend
  leads: number;
  qualified: number;
  costPerLead: number; // Цена лида = ad_spend / leads
  trialLessons: number; // Пробные уроки (education)
  sales: number;
  conversion: number; // Конверсия, % = sales / leads
  roas: number; // ROAS = revenue / ad_spend
}

const num = (v: number | null | undefined) => Number(v ?? 0);

/** Свести массив дневных метрик в агрегированные показатели дашборда. */
export function aggregateMetrics(rows: DailyMetric[]): DerivedMetrics {
  const revenue = rows.reduce((s, r) => s + num(r.revenue), 0);
  const adSpend = rows.reduce((s, r) => s + num(r.ad_spend), 0);
  const leads = rows.reduce((s, r) => s + num(r.leads), 0);
  const qualified = rows.reduce((s, r) => s + num(r.qualified), 0);
  const trialLessons = rows.reduce((s, r) => s + num(r.trial_lessons), 0);
  const sales = rows.reduce((s, r) => s + num(r.sales), 0);

  return {
    revenue,
    adSpend,
    netProfit: revenue - adSpend,
    leads,
    qualified,
    costPerLead: leads > 0 ? adSpend / leads : 0,
    trialLessons,
    sales,
    conversion: leads > 0 ? (sales / leads) * 100 : 0,
    roas: adSpend > 0 ? revenue / adSpend : 0,
  };
}
