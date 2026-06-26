import {
  Banknote,
  TrendingDown,
  PiggyBank,
  ShoppingCart,
  Receipt,
  Percent,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { rangeFromSearchParams, rangeEndExclusive } from "@/lib/date-range";
import { PageHeader } from "@/components/page-header";
import { MetricCard } from "@/components/metric-card";
import { DateRangePicker } from "@/components/date-range-picker";
import { Avatar } from "@/components/avatar";
import { formatCurrency, formatNumber, formatPercent, formatDate } from "@/lib/format";

export default async function SalesPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { projectId } = await params;
  const range = rangeFromSearchParams(await searchParams);

  const supabase = await createClient();

  const endExclusive = rangeEndExclusive(range);
  const [{ data: metrics }, { data: sales }, { count: leadsCount }] =
    await Promise.all([
      supabase
        .from("metrics_daily")
        .select("ad_spend")
        .eq("project_id", projectId)
        .gte("date", range.from)
        .lte("date", range.to),
      supabase
        .from("sales")
        .select("id, product, amount, manager_id, customer_id, created_at")
        .eq("project_id", projectId)
        .gte("created_at", range.from)
        .lt("created_at", endExclusive)
        .order("created_at", { ascending: false }),
      supabase
        .from("leads")
        .select("id", { count: "exact", head: true })
        .eq("project_id", projectId)
        .gte("created_at", range.from)
        .lt("created_at", endExclusive),
    ]);

  const rows = sales ?? [];

  // Показатели за период считаем из реальных продаж (CRM); расход — из metrics_daily
  const salesCount = rows.length;
  const salesRevenue = rows.reduce((s, r) => s + Number(r.amount), 0);
  const adSpend = (metrics ?? []).reduce((s, m) => s + Number(m.ad_spend), 0);
  const netProfit = salesRevenue - adSpend;
  const avgCheck = salesCount > 0 ? salesRevenue / salesCount : 0;
  const conversion = leadsCount && leadsCount > 0 ? (salesCount / leadsCount) * 100 : 0;

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

  // «Сколько каждый менеджер продал» за период
  const byManager = new Map<string, { count: number; sum: number }>();
  rows.forEach((s) => {
    if (!s.manager_id) return;
    const cur = byManager.get(s.manager_id) ?? { count: 0, sum: 0 };
    cur.count += 1;
    cur.sum += Number(s.amount);
    byManager.set(s.manager_id, cur);
  });
  const managerStats = [...byManager.entries()]
    .map(([id, v]) => ({ name: managerById.get(id) ?? "—", ...v }))
    .sort((a, b) => b.sum - a.sum);

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <PageHeader title="Продажи" subtitle={`Период: ${range.label}`}>
        <DateRangePicker preset={range.preset} from={range.from} to={range.to} label={range.label} />
      </PageHeader>

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-3">
        <MetricCard label="Доход" value={formatCurrency(salesRevenue)} icon={Banknote} />
        <MetricCard label="Расходы" value={formatCurrency(adSpend)} icon={TrendingDown} />
        <MetricCard label="Чистая прибыль" value={formatCurrency(netProfit)} icon={PiggyBank} accent />
        <MetricCard label="Количество продаж" value={formatNumber(salesCount)} icon={ShoppingCart} />
        <MetricCard label="Средний чек" value={formatCurrency(avgCheck)} icon={Receipt} />
        <MetricCard label="Конверсия (из лидов)" value={formatPercent(conversion)} icon={Percent} />
      </div>

      {managerStats.length > 0 && (
        <div className="mb-6 rounded-card bg-surface p-6 shadow-soft ring-1 ring-line">
          <h2 className="mb-4 text-base font-semibold text-ink">
            Продажи по менеджерам за период
          </h2>
          <ul className="space-y-3">
            {managerStats.map((m) => (
              <li key={m.name} className="flex items-center gap-3">
                <Avatar name={m.name} size="sm" />
                <span className="flex-1 font-medium text-ink">{m.name}</span>
                <span className="text-sm text-muted">
                  {formatNumber(m.count)}{" "}
                  {m.count === 1 ? "продажа" : "продаж"}
                </span>
                <span className="w-32 text-right font-semibold text-brand-ink">
                  {formatCurrency(m.sum)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

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
