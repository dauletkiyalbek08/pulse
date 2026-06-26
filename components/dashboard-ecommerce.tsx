import {
  Users,
  UserPlus,
  ShoppingCart,
  Banknote,
  TrendingDown,
  Tag,
  Percent,
  PiggyBank,
  Gauge,
  Boxes,
  Package,
  AlertTriangle,
  Wallet,
  Sparkles,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { aggregateMetrics } from "@/lib/metrics";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/format";
import { MetricCard } from "@/components/metric-card";
import { RevenueChart } from "@/components/revenue-chart";
import { FunnelCard } from "@/components/funnel-card";
import { TopList } from "@/components/top-list";
import { DateRangePicker } from "@/components/date-range-picker";
import type { DateRange } from "@/lib/date-range";

export async function DashboardEcommerce({
  projectId,
  projectName,
  range,
}: {
  projectId: string;
  projectName: string;
  range: DateRange;
}) {
  const supabase = await createClient();

  const [
    { data: metrics },
    { data: members },
    { data: sales },
    { data: products },
  ] = await Promise.all([
    supabase
      .from("metrics_daily")
      .select("*")
      .eq("project_id", projectId)
      .gte("date", range.from)
      .lte("date", range.to)
      .order("date", { ascending: true }),
    supabase
      .from("project_members")
      .select("user_id, role")
      .eq("project_id", projectId)
      .eq("status", "active"),
    supabase.from("sales").select("manager_id, amount").eq("project_id", projectId),
    supabase
      .from("products")
      .select("stock_quantity, cost_price, low_stock_threshold")
      .eq("project_id", projectId),
  ]);

  const rows = metrics ?? [];
  const agg = aggregateMetrics(rows);
  const todayStr = new Date().toISOString().slice(0, 10);
  const { data: todayRow } = await supabase
    .from("metrics_daily")
    .select("leads")
    .eq("project_id", projectId)
    .eq("date", todayStr)
    .maybeSingle();
  const newToday = todayRow?.leads ?? 0;
  const chartData = rows.map((r) => ({
    date: r.date,
    revenue: Number(r.revenue),
    adSpend: Number(r.ad_spend),
  }));

  // Топ менеджеров
  const memberIds = (members ?? []).map((m) => m.user_id);
  const { data: profiles } = memberIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", memberIds)
    : { data: [] };
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
  const managerSum = new Map<string, number>();
  (sales ?? []).forEach((s) => {
    if (!s.manager_id) return;
    managerSum.set(
      s.manager_id,
      (managerSum.get(s.manager_id) ?? 0) + Number(s.amount),
    );
  });
  const topManagers = [...managerSum.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id, sum]) => ({ name: nameById.get(id) ?? "—", value: formatCurrency(sum) }));

  // Склад
  const items = products ?? [];
  const catalogCount = items.length;
  const totalUnits = items.reduce((s, p) => s + p.stock_quantity, 0);
  const lowStock = items.filter(
    (p) => p.stock_quantity <= p.low_stock_threshold,
  ).length;
  const stockCost = items.reduce(
    (s, p) => s + p.stock_quantity * Number(p.cost_price),
    0,
  );

  const funnelStages = [
    { label: "Лиды", value: agg.leads },
    { label: "Обработаны", value: agg.qualified },
    { label: "Продажи", value: agg.sales },
  ];

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">{projectName}</h1>
          <p className="mt-1 text-sm text-muted">Период: {range.label}</p>
        </div>
        <DateRangePicker
          preset={range.preset}
          from={range.from}
          to={range.to}
          label={range.label}
        />
      </div>

      {/* Живая сводка дня (заглушка AI-подсказки) */}
      <div className="mb-6 flex gap-3 rounded-card bg-brand-soft/60 p-5 ring-1 ring-brand/20">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand text-white">
          <Sparkles className="h-5 w-5" />
        </span>
        <div>
          <div className="text-sm font-semibold text-ink">Живая сводка дня</div>
          <p className="mt-1 text-sm text-muted">
            Сегодня лиды дешевле обычного, конверсия в продажу выше средней по
            месяцу. Стоит усилить топ-креатив в TikTok и пополнить остатки по{" "}
            {lowStock} SKU, которые заканчиваются.
          </p>
        </div>
      </div>

      {/* Метрики ниши «товарка» */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <MetricCard label="Всего лидов" value={formatNumber(agg.leads)} icon={Users} />
        <MetricCard label="Новые сегодня" value={formatNumber(newToday)} icon={UserPlus} />
        <MetricCard label="Продажи" value={formatNumber(agg.sales)} icon={ShoppingCart} />
        <MetricCard label="Выручка" value={formatCurrency(agg.revenue)} icon={Banknote} />
        <MetricCard label="Расход (TikTok)" value={formatCurrency(agg.adSpend)} icon={TrendingDown} />
        <MetricCard label="Цена лида" value={formatCurrency(agg.costPerLead)} icon={Tag} />
        <MetricCard label="Конверсия" value={formatPercent(agg.conversion)} icon={Percent} />
        <MetricCard
          label="Валовая прибыль"
          value={formatCurrency(agg.netProfit)}
          icon={PiggyBank}
          accent
        />
        <MetricCard label="ROAS" value={`${agg.roas.toFixed(2)}×`} icon={Gauge} />
      </div>

      {/* Склад */}
      <h2 className="mb-4 mt-8 text-base font-semibold text-ink">Склад</h2>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard label="Товаров в каталоге" value={formatNumber(catalogCount)} icon={Boxes} />
        <MetricCard label="Единиц на складе" value={formatNumber(totalUnits)} icon={Package} />
        <MetricCard label="Заканчиваются" value={formatNumber(lowStock)} icon={AlertTriangle} />
        <MetricCard label="Себестоимость склада" value={formatCurrency(stockCost)} icon={Wallet} />
      </div>

      {/* График + воронка */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-card bg-surface p-6 shadow-soft ring-1 ring-line lg:col-span-2">
          <h2 className="text-base font-semibold text-ink">Динамика выручки</h2>
          <div className="mt-4">
            <RevenueChart data={chartData} />
          </div>
        </div>
        <div className="rounded-card bg-surface p-6 shadow-soft ring-1 ring-line">
          <h2 className="mb-5 text-base font-semibold text-ink">Воронка</h2>
          <FunnelCard stages={funnelStages} />
        </div>
      </div>

      {/* Топ менеджеров */}
      <div className="mt-6 rounded-card bg-surface p-6 shadow-soft ring-1 ring-line lg:max-w-md">
        <h2 className="mb-5 text-base font-semibold text-ink">Топ менеджеров</h2>
        <TopList items={topManagers} />
      </div>
    </div>
  );
}
