import { Users, GraduationCap, ShoppingBag, Coins, TrendingDown, Percent, TrendingUp, Tag } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getProject, requireAccess } from "@/lib/queries";
import { getNiche } from "@/lib/niches";
import { roleLabel } from "@/lib/members";
import { sourceLabel } from "@/lib/leads";
import { rangeFromSearchParams, rangeEndExclusive } from "@/lib/date-range";
import { formatCurrency, formatCurrencyShort, formatNumber, formatPercent } from "@/lib/format";
import { getCohortFunnel } from "@/lib/funnel";
import { getLiveAds } from "@/lib/ads-live";
import { getDailyAdReport } from "@/lib/ads-daily";
import { getAudienceBreakdown } from "@/lib/ads-audience";
import { PageHeader } from "@/components/page-header";
import { DateRangePicker } from "@/components/date-range-picker";
import { MetricCard } from "@/components/metric-card";
import { FunnelCard } from "@/components/funnel-card";
import { ExportButton } from "@/components/export-button";
import { ReportTable } from "@/components/report-table";
import { RnpReport } from "@/components/rnp-report";
import { BreakdownBars } from "@/components/breakdown-bars";

const pct = (n: number, d: number) => (d > 0 ? (n / d) * 100 : 0);
const roundPct = (n: number, d: number) => (d > 0 ? `${((n / d) * 100).toFixed(1)}%` : "—");

/**
 * Отчёты: сводный отчёт по проекту за период на реальных данных
 * (лиды, пробные, продажи, живой расход Meta → ₸). Разбивки по менеджерам,
 * хантерам и источникам с экспортом в CSV.
 */
export default async function ReportsPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { projectId } = await params;
  await requireAccess(projectId, "reports");
  const range = rangeFromSearchParams(await searchParams);

  const supabase = await createClient();
  const project = await getProject(projectId);
  const niche = getNiche(project?.niche);
  const isEducation = niche.key !== "ecommerce";

  const [{ data: proj }, { data: leads }, { data: sales }, { data: trials }, { data: members }, live, funnel] =
    await Promise.all([
      supabase.from("projects").select("usd_rate").eq("id", projectId).maybeSingle(),
      supabase
        .from("leads")
        .select("source, status, assigned_to")
        .eq("project_id", projectId)
        .gte("created_at", range.from)
        .lt("created_at", rangeEndExclusive(range)),
      supabase
        .from("sales")
        .select("manager_id, amount, lead_id")
        .eq("project_id", projectId)
        .gte("created_at", range.from)
        .lt("created_at", rangeEndExclusive(range)),
      supabase
        .from("trials")
        .select("assigned_to, status")
        .eq("project_id", projectId)
        .gte("scheduled_at", range.from)
        .lt("scheduled_at", rangeEndExclusive(range)),
      supabase
        .from("project_members")
        .select("user_id, role, status")
        .eq("project_id", projectId)
        .in("role", ["manager", "head_sales", "hunter"])
        .eq("status", "active"),
      getLiveAds(projectId, "campaign", range.from, range.to),
      getCohortFunnel(projectId, niche.key, range),
    ]);

  const usdRate = Number(proj?.usd_rate ?? 500);
  // Реклама: ежедневный отчёт (РНП) + разбивка аудитории — из Meta, в долларах.
  const [daily, audience] = await Promise.all([
    getDailyAdReport(projectId, range.from, range.to),
    getAudienceBreakdown(projectId, range.from, range.to),
  ]);
  const leadsArr = leads ?? [];
  const salesArr = sales ?? [];
  const trialsArr = trials ?? [];
  const team = members ?? [];

  // Имена сотрудников + источники лидов по продажам
  const memberIds = team.map((m) => m.user_id);
  const saleLeadIds = [...new Set(salesArr.map((s) => s.lead_id).filter(Boolean))] as string[];
  const { data: profiles } = memberIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", memberIds)
    : { data: [] };
  const { data: saleLeads } = saleLeadIds.length
    ? await supabase.from("leads").select("id, source").in("id", saleLeadIds)
    : { data: [] };
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
  const saleSrcById = new Map((saleLeads ?? []).map((l) => [l.id, l.source ?? "other"]));

  // Итоги
  const leadsCount = leadsArr.length;
  const reachedTrial = leadsArr.filter((l) => ["trial", "trial_done", "paid"].includes(l.status)).length;
  const salesCount = salesArr.length;
  const revenue = salesArr.reduce((s, x) => s + Number(x.amount), 0);
  const adUsd = live.campaigns.filter((c) => c.objective === "course").reduce((s, c) => s + Number(c.spend), 0);
  const adKzt = adUsd * usdRate;
  const roas = adKzt > 0 ? revenue / adKzt : null;
  const avgCheck = salesCount > 0 ? revenue / salesCount : 0;

  // По менеджерам: уроки/успешно из trials, продажи/выручка из sales
  const tByU = new Map<string, { trials: number; purchased: number }>();
  for (const t of trialsArr) {
    if (!t.assigned_to) continue;
    const a = tByU.get(t.assigned_to) ?? { trials: 0, purchased: 0 };
    a.trials += 1;
    if (t.status === "purchased") a.purchased += 1;
    tByU.set(t.assigned_to, a);
  }
  const sByU = new Map<string, { sales: number; revenue: number }>();
  for (const s of salesArr) {
    if (!s.manager_id) continue;
    const a = sByU.get(s.manager_id) ?? { sales: 0, revenue: 0 };
    a.sales += 1;
    a.revenue += Number(s.amount);
    sByU.set(s.manager_id, a);
  }
  const managers = team.filter((m) => m.role === "manager");
  const managerData = managers
    .map((m) => {
      const t = tByU.get(m.user_id) ?? { trials: 0, purchased: 0 };
      const s = sByU.get(m.user_id) ?? { sales: 0, revenue: 0 };
      return { name: nameById.get(m.user_id) ?? "—", ...t, ...s };
    })
    .sort((a, b) => b.revenue - a.revenue);

  // По хантерам: лиды/квалифицировано
  const QUALIFIED = ["assigned", "trial", "trial_done", "paid"];
  const hByU = new Map<string, { leads: number; qualified: number }>();
  for (const l of leadsArr) {
    if (!l.assigned_to) continue;
    const a = hByU.get(l.assigned_to) ?? { leads: 0, qualified: 0 };
    a.leads += 1;
    if (QUALIFIED.includes(l.status)) a.qualified += 1;
    hByU.set(l.assigned_to, a);
  }
  const hunters = team.filter((m) => m.role === "hunter");
  const hunterData = hunters
    .map((m) => {
      const h = hByU.get(m.user_id) ?? { leads: 0, qualified: 0 };
      return { name: nameById.get(m.user_id) ?? "—", ...h };
    })
    .sort((a, b) => b.leads - a.leads);

  // По источникам: лиды (за период) + продажи/выручка (привязка через лид продажи)
  const srcLeads = new Map<string, number>();
  for (const l of leadsArr) {
    const s = l.source ?? "other";
    srcLeads.set(s, (srcLeads.get(s) ?? 0) + 1);
  }
  const srcSales = new Map<string, { count: number; rev: number }>();
  for (const s of salesArr) {
    const src = (s.lead_id ? saleSrcById.get(s.lead_id) : null) ?? "other";
    const a = srcSales.get(src) ?? { count: 0, rev: 0 };
    a.count += 1;
    a.rev += Number(s.amount);
    srcSales.set(src, a);
  }
  const sourceData = [...new Set([...srcLeads.keys(), ...srcSales.keys()])]
    .map((src) => ({
      src,
      leads: srcLeads.get(src) ?? 0,
      sales: srcSales.get(src)?.count ?? 0,
      revenue: srcSales.get(src)?.rev ?? 0,
    }))
    .sort((a, b) => b.leads - a.leads);

  // Экспорт сводки
  const summaryExport: (string | number)[][] = [
    ["Лиды", leadsCount],
    ["Пробные (дошли)", reachedTrial],
    ["Продажи", salesCount],
    ["Выручка ₸", Math.round(revenue)],
    ["Расход рекламы ₸", Math.round(adKzt)],
    ["Конверсия %", pct(salesCount, leadsCount).toFixed(1)],
    ["ROAS", roas != null ? roas.toFixed(2) : "—"],
    ["Средний чек ₸", Math.round(avgCheck)],
  ];

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <PageHeader title="Отчёты" subtitle={`Сводный отчёт по проекту · период: ${range.label}`}>
        <DateRangePicker preset={range.preset} from={range.from} to={range.to} label={range.label} />
      </PageHeader>

      <div className="mb-3 flex justify-end">
        <ExportButton
          filename={`report-${projectId.slice(0, 8)}-${range.from}`}
          headers={["Показатель", "Значение"]}
          rows={summaryExport}
          label="Скачать отчёт"
        />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard label="Лиды" value={formatNumber(leadsCount)} icon={Users} />
        {isEducation && <MetricCard label="Пробные" value={formatNumber(reachedTrial)} icon={GraduationCap} />}
        <MetricCard label="Продажи" value={formatNumber(salesCount)} icon={ShoppingBag} />
        <MetricCard label="Выручка" value={formatCurrencyShort(revenue)} accent icon={Coins} />
        <MetricCard label="Расход рекламы" value={formatCurrencyShort(adKzt)} hint={`$${formatNumber(Math.round(adUsd))} · курс ${usdRate} ₸`} icon={TrendingDown} />
        <MetricCard label="Конверсия в продажу" value={formatPercent(pct(salesCount, leadsCount))} icon={Percent} />
        <MetricCard label="ROAS" value={roas != null ? `${roas.toFixed(1).replace(".", ",")}x` : "—"} icon={TrendingUp} />
        <MetricCard label="Средний чек" value={salesCount > 0 ? formatCurrencyShort(avgCheck) : "—"} icon={Tag} />
      </div>

      {/* Ежедневный отчёт по рекламе (РНП) — таблица/диаграмма, для таргетолога */}
      <div className="mt-6">
        <RnpReport rows={daily.rows} connected={daily.connected} from={range.from} to={range.to} />
      </div>

      {/* Аудитория рекламы: откуда и кто оставляет лиды (Meta) */}
      <div className="mt-6">
        <h2 className="mb-1 text-base font-semibold text-ink">Аудитория рекламы</h2>
        <p className="mb-3 text-xs text-faint">
          Откуда приходят лиды и кто это — по данным Meta за период
          {audience.connected ? "" : " · подключите Meta в разделе «Реклама»"}
        </p>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <BreakdownBars
            title={audience.regionHasLeads ? "По городу / региону" : "По городу / региону (клики)"}
            rows={audience.byRegion}
            metric={audience.regionHasLeads ? "leads" : "clicks"}
            max={10}
          />
          <BreakdownBars
            title="По возрасту"
            rows={audience.byAge}
            max={8}
            targetLabels={["25-34", "35-44", "45-54"]}
            targetTitle="Целевая аудитория 24–55"
          />
          <BreakdownBars title="По полу" rows={audience.byGender} max={4} />
        </div>
        {audience.connected && !audience.regionHasLeads && (
          <p className="mt-2 text-xs text-faint">
            Meta не отдаёт лиды в разрезе города для лид-форм — по региону показаны клики (переходы), это ближайший
            сигнал «откуда заходят». Лиды по возрасту и полу — точные.
          </p>
        )}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-card bg-surface p-6 shadow-soft ring-1 ring-line lg:col-span-1">
          <h2 className="text-base font-semibold text-ink">Воронка</h2>
          <p className="mb-5 mt-0.5 text-xs text-faint">Из лидов за период — сколько дошло до этапа</p>
          <FunnelCard stages={funnel} />
        </div>

        <div className="lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold text-ink">Менеджеры</h2>
            <ExportButton
              filename={`report-managers-${range.from}`}
              headers={isEducation ? ["Менеджер", "Уроки", "Успешно", "Конверсия %", "Продажи", "Выручка ₸"] : ["Менеджер", "Продажи", "Выручка ₸"]}
              rows={managerData.map((m) =>
                isEducation
                  ? [m.name, m.trials, m.purchased, pct(m.purchased, m.trials).toFixed(1), m.sales, Math.round(m.revenue)]
                  : [m.name, m.sales, Math.round(m.revenue)],
              )}
            />
          </div>
          <ReportTable
            columns={
              isEducation
                ? [{ label: "Менеджер" }, { label: "Уроки" }, { label: "Успешно" }, { label: "Конверсия" }, { label: "Продажи" }, { label: "Выручка" }]
                : [{ label: "Менеджер" }, { label: "Продажи" }, { label: "Выручка" }]
            }
            rows={managerData.map((m) =>
              isEducation
                ? [m.name, formatNumber(m.trials), formatNumber(m.purchased), roundPct(m.purchased, m.trials), formatNumber(m.sales), formatCurrency(m.revenue)]
                : [m.name, formatNumber(m.sales), formatCurrency(m.revenue)],
            )}
            total={
              isEducation
                ? [
                    "Итого",
                    formatNumber(managerData.reduce((s, m) => s + m.trials, 0)),
                    formatNumber(managerData.reduce((s, m) => s + m.purchased, 0)),
                    "",
                    formatNumber(managerData.reduce((s, m) => s + m.sales, 0)),
                    formatCurrency(managerData.reduce((s, m) => s + m.revenue, 0)),
                  ]
                : ["Итого", formatNumber(managerData.reduce((s, m) => s + m.sales, 0)), formatCurrency(managerData.reduce((s, m) => s + m.revenue, 0))]
            }
            empty="В отделе продаж нет данных за период."
          />
        </div>
      </div>

      {isEducation && (
        <div className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold text-ink">Хантеры</h2>
            <ExportButton
              filename={`report-hunters-${range.from}`}
              headers={["Хантер", "Лиды", "Квалифицировано", "Конверсия %"]}
              rows={hunterData.map((h) => [h.name, h.leads, h.qualified, pct(h.qualified, h.leads).toFixed(1)])}
            />
          </div>
          <ReportTable
            columns={[{ label: "Хантер" }, { label: "Лиды" }, { label: "Квалифицировано" }, { label: "Конверсия" }]}
            rows={hunterData.map((h) => [h.name, formatNumber(h.leads), formatNumber(h.qualified), roundPct(h.qualified, h.leads)])}
            total={[
              "Итого",
              formatNumber(hunterData.reduce((s, h) => s + h.leads, 0)),
              formatNumber(hunterData.reduce((s, h) => s + h.qualified, 0)),
              "",
            ]}
            empty="Нет лидов, назначенных хантерам, за период."
          />
        </div>
      )}

      <div className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-ink">Источники лидов</h2>
          <ExportButton
            filename={`report-sources-${range.from}`}
            headers={["Источник", "Лиды", "Продажи", "Выручка ₸"]}
            rows={sourceData.map((s) => [sourceLabel(s.src), s.leads, s.sales, Math.round(s.revenue)])}
          />
        </div>
        <ReportTable
          columns={[{ label: "Источник" }, { label: "Лиды" }, { label: "Продажи" }, { label: "Конверсия" }, { label: "Выручка" }]}
          rows={sourceData.map((s) => [
            sourceLabel(s.src),
            formatNumber(s.leads),
            formatNumber(s.sales),
            roundPct(s.sales, s.leads),
            formatCurrency(s.revenue),
          ])}
          total={[
            "Итого",
            formatNumber(sourceData.reduce((a, s) => a + s.leads, 0)),
            formatNumber(sourceData.reduce((a, s) => a + s.sales, 0)),
            "",
            formatCurrency(sourceData.reduce((a, s) => a + s.revenue, 0)),
          ]}
          empty="Нет лидов за период."
        />
      </div>
    </div>
  );
}
