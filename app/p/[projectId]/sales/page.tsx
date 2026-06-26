import {
  Banknote,
  TrendingDown,
  PiggyBank,
  ShoppingCart,
  Receipt,
  Percent,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { resolveDateRange } from "@/lib/date-range";
import { aggregateMetrics } from "@/lib/metrics";
import { PageHeader } from "@/components/page-header";
import { MetricCard } from "@/components/metric-card";
import { DateRangePicker } from "@/components/date-range-picker";
import { formatCurrency, formatNumber, formatPercent, formatDate } from "@/lib/format";

const str = (v: string | string[] | undefined) =>
  typeof v === "string" ? v : undefined;

function nextDay(date: string): string {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export default async function SalesPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { projectId } = await params;
  const sp = await searchParams;
  const range = resolveDateRange({ range: str(sp.range), from: str(sp.from), to: str(sp.to) });

  const supabase = await createClient();

  const [{ data: metrics }, { data: sales }] = await Promise.all([
    supabase
      .from("metrics_daily")
      .select("*")
      .eq("project_id", projectId)
      .gte("date", range.from)
      .lte("date", range.to),
    supabase
      .from("sales")
      .select("id, product, amount, manager_id, customer_id, created_at")
      .eq("project_id", projectId)
      .gte("created_at", range.from)
      .lt("created_at", nextDay(range.to))
      .order("created_at", { ascending: false }),
  ]);

  const agg = aggregateMetrics(metrics ?? []);
  const rows = sales ?? [];

  // Имена менеджеров и клиентов
  const managerIds = [...new Set(rows.map((s) => s.manager_id).filter(Boolean))] as string[];
  const customerIds = [...new Set(rows.map((s) => s.customer_id).filter(Boolean))] as string[];
  const [{ data: profiles }, { data: customers }] = await Promise.all([
    managerIds.length
      ? supabase.from("profiles").select("id, full_name").in("id", managerIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
    customerIds.length
      ? supabase.from("customers").select("id, full_name").in("id", customerIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
  ]);
  const managerById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
  const customerById = new Map((customers ?? []).map((c) => [c.id, c.full_name]));

  const avgCheck = agg.sales > 0 ? agg.revenue / agg.sales : 0;

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <PageHeader title="Продажи" subtitle={`Период: ${range.label}`}>
        <DateRangePicker preset={range.preset} from={range.from} to={range.to} label={range.label} />
      </PageHeader>

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-3">
        <MetricCard label="Доход" value={formatCurrency(agg.revenue)} icon={Banknote} />
        <MetricCard label="Расходы" value={formatCurrency(agg.adSpend)} icon={TrendingDown} />
        <MetricCard label="Чистая прибыль" value={formatCurrency(agg.netProfit)} icon={PiggyBank} accent />
        <MetricCard label="Количество продаж" value={formatNumber(agg.sales)} icon={ShoppingCart} />
        <MetricCard label="Средний чек" value={formatCurrency(avgCheck)} icon={Receipt} />
        <MetricCard label="Конверсия" value={formatPercent(agg.conversion)} icon={Percent} />
      </div>

      <h2 className="mb-3 text-base font-semibold text-ink">Записи о продажах</h2>
      {rows.length === 0 ? (
        <div className="rounded-card border border-dashed border-line bg-surface px-6 py-16 text-center text-sm text-muted">
          За выбранный период продаж нет.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-card bg-surface shadow-soft ring-1 ring-line">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-faint">
                <th className="px-5 py-3 font-medium">Дата</th>
                <th className="px-5 py-3 font-medium">Клиент</th>
                <th className="px-5 py-3 font-medium">Товар / курс</th>
                <th className="px-5 py-3 font-medium">Менеджер</th>
                <th className="px-5 py-3 text-right font-medium">Сумма</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((sale) => (
                <tr
                  key={sale.id}
                  className="border-b border-line last:border-0 transition hover:bg-canvas"
                >
                  <td className="px-5 py-3 text-muted">{formatDate(sale.created_at)}</td>
                  <td className="px-5 py-3 text-ink">
                    {sale.customer_id ? customerById.get(sale.customer_id) ?? "—" : "—"}
                  </td>
                  <td className="px-5 py-3 font-medium text-ink">{sale.product ?? "—"}</td>
                  <td className="px-5 py-3 text-muted">
                    {sale.manager_id ? managerById.get(sale.manager_id) ?? "—" : "—"}
                  </td>
                  <td className="px-5 py-3 text-right font-semibold text-ink">
                    {formatCurrency(Number(sale.amount))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
