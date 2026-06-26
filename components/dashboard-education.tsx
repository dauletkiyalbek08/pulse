import {
  Banknote,
  TrendingDown,
  PiggyBank,
  Users,
  Tag,
  BookOpen,
  GraduationCap,
  Percent,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { aggregateMetrics } from "@/lib/metrics";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/format";
import { MetricCard } from "@/components/metric-card";
import { RevenueChart } from "@/components/revenue-chart";
import { FunnelCard } from "@/components/funnel-card";
import { TopList } from "@/components/top-list";
import { DateRangePicker } from "@/components/date-range-picker";
import { getCohortFunnel } from "@/lib/funnel";
import type { DateRange } from "@/lib/date-range";

const QUALIFYING_STATUSES = ["qualified", "trial", "sale"];

function pluralLeads(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "лид";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "лида";
  return "лидов";
}

export async function DashboardEducation({
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
    { data: leads },
    funnelStages,
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
    supabase.from("leads").select("assigned_to, status").eq("project_id", projectId),
    getCohortFunnel(projectId, "education", range),
  ]);

  const rows = metrics ?? [];
  const agg = aggregateMetrics(rows);
  const chartData = rows.map((r) => ({
    date: r.date,
    revenue: Number(r.revenue),
    adSpend: Number(r.ad_spend),
  }));

  const memberIds = (members ?? []).map((m) => m.user_id);
  const { data: profiles } = memberIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", memberIds)
    : { data: [] };
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
  const roleById = new Map((members ?? []).map((m) => [m.user_id, m.role]));

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

  const hunterCount = new Map<string, number>();
  (leads ?? []).forEach((l) => {
    if (!l.assigned_to) return;
    if (roleById.get(l.assigned_to) !== "hunter") return;
    if (!QUALIFYING_STATUSES.includes(l.status)) return;
    hunterCount.set(l.assigned_to, (hunterCount.get(l.assigned_to) ?? 0) + 1);
  });
  const topHunters = [...hunterCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id, count]) => ({
      name: nameById.get(id) ?? "—",
      value: `${formatNumber(count)} ${pluralLeads(count)}`,
    }));

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

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard label="Доход" value={formatCurrency(agg.revenue)} icon={Banknote} />
        <MetricCard label="Расходы" value={formatCurrency(agg.adSpend)} icon={TrendingDown} />
        <MetricCard
          label="Чистая прибыль"
          value={formatCurrency(agg.netProfit)}
          icon={PiggyBank}
          accent
        />
        <MetricCard label="Лиды" value={formatNumber(agg.leads)} icon={Users} />
        <MetricCard label="Цена лида" value={formatCurrency(agg.costPerLead)} icon={Tag} />
        <MetricCard
          label="Пробные уроки"
          value={formatNumber(agg.trialLessons)}
          icon={BookOpen}
        />
        <MetricCard
          label="Продажи курса"
          value={formatNumber(agg.sales)}
          icon={GraduationCap}
        />
        <MetricCard label="Конверсия" value={formatPercent(agg.conversion)} icon={Percent} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-card bg-surface p-6 shadow-soft ring-1 ring-line lg:col-span-2">
          <h2 className="text-base font-semibold text-ink">Динамика дохода</h2>
          <div className="mt-4">
            <RevenueChart data={chartData} />
          </div>
        </div>
        <div className="rounded-card bg-surface p-6 shadow-soft ring-1 ring-line">
          <h2 className="text-base font-semibold text-ink">Воронка по лидам</h2>
          <p className="mb-5 mt-0.5 text-xs text-faint">
            Из лидов за период «{range.label.toLowerCase()}» — сколько дошло до этапа
          </p>
          <FunnelCard stages={funnelStages} />
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-card bg-surface p-6 shadow-soft ring-1 ring-line">
          <h2 className="mb-5 text-base font-semibold text-ink">Топ хантеров</h2>
          <TopList items={topHunters} />
        </div>
        <div className="rounded-card bg-surface p-6 shadow-soft ring-1 ring-line">
          <h2 className="mb-5 text-base font-semibold text-ink">Топ менеджеров</h2>
          <TopList items={topManagers} />
        </div>
      </div>
    </div>
  );
}
