import { Megaphone, GraduationCap, Briefcase, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireAccess } from "@/lib/queries";
import { rangeFromSearchParams } from "@/lib/date-range";
import { objectiveLabel } from "@/lib/ads";
import { formatUsd, formatNumber, formatDate } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { DateRangePicker } from "@/components/date-range-picker";
import { ExportButton } from "@/components/export-button";
import { CampaignsTable, type CampaignRow } from "@/components/campaigns-table";
import { MetaIntegration } from "@/components/meta-integration";
import { getMetaStatuses } from "@/app/p/[projectId]/ads/integration-actions";

export default async function AdsPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { projectId } = await params;
  await requireAccess(projectId, "ads");
  const range = rangeFromSearchParams(await searchParams);

  const supabase = await createClient();

  const [{ data: campData }, statuses] = await Promise.all([
    supabase
      .from("ad_campaigns")
      .select("id, name, objective, status, spend, impressions, clicks, reach, leads, period_from, period_to")
      .eq("project_id", projectId)
      .order("spend", { ascending: false }),
    getMetaStatuses(projectId),
  ]);

  const campaigns = (campData ?? []) as (CampaignRow & {
    period_from: string | null;
    period_to: string | null;
  })[];

  const courseStatus = statuses.find((s) => s.purpose === "course") ?? null;
  const vacancyStatus = statuses.find((s) => s.purpose === "vacancy") ?? null;

  const totalSpend = campaigns.reduce((s, c) => s + Number(c.spend), 0);
  const courseSpend = campaigns.filter((c) => c.objective === "course").reduce((s, c) => s + Number(c.spend), 0);
  const vacancySpend = campaigns.filter((c) => c.objective === "vacancy").reduce((s, c) => s + Number(c.spend), 0);
  const totalLeads = campaigns.reduce((s, c) => s + Number(c.leads), 0);
  const cpl = totalLeads > 0 ? totalSpend / totalLeads : 0;

  const campPeriod =
    campaigns[0]?.period_from && campaigns[0]?.period_to
      ? `${formatDate(campaigns[0].period_from)} – ${formatDate(campaigns[0].period_to)}`
      : null;

  const campExport = campaigns.map((c) => [
    c.name,
    objectiveLabel(c.objective),
    c.status === "active" ? "Активна" : "Пауза",
    c.impressions,
    c.clicks,
    c.impressions > 0 ? `${((c.clicks / c.impressions) * 100).toFixed(2)}%` : "—",
    c.reach,
    c.leads,
    c.leads > 0 ? Math.round(c.spend / c.leads) : 0,
    Math.round(c.spend),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <PageHeader title="Реклама" subtitle="Кабинеты Meta, кампании и расходы (в долларах $) — автоматически">
        <DateRangePicker preset={range.preset} from={range.from} to={range.to} label={range.label} />
      </PageHeader>

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Всего на рекламу" value={formatUsd(totalSpend)} icon={Megaphone} tone="brand" />
        <StatCard label="На курс" value={formatUsd(courseSpend)} icon={GraduationCap} tone="ink" />
        <StatCard label="На вакансии" value={formatUsd(vacancySpend)} icon={Briefcase} tone="ink" />
        <StatCard
          label={`Лидов: ${formatNumber(totalLeads)} · цена`}
          value={cpl > 0 ? formatUsd(cpl, 2) : "—"}
          icon={Users}
          tone="ink"
        />
      </div>

      {/* Два рекламных кабинета: курс и вакансии */}
      <div className="mb-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <MetaIntegration
          projectId={projectId}
          purpose="course"
          title="Курс"
          status={courseStatus}
          rangeFrom={range.from}
          rangeTo={range.to}
          rangeLabel={range.label}
        />
        <MetaIntegration
          projectId={projectId}
          purpose="vacancy"
          title="Вакансии"
          status={vacancyStatus}
          rangeFrom={range.from}
          rangeTo={range.to}
          rangeLabel={range.label}
        />
      </div>

      {/* Кампании (как в Ads Manager) */}
      <div className="mb-2 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-ink">Кампании</h2>
          <p className="text-xs text-muted">
            {campaigns.length > 0
              ? `${campaigns.length} кампаний${campPeriod ? ` · ${campPeriod}` : ""}`
              : "Подключите кабинет и нажмите «Синхронизировать»"}
          </p>
        </div>
        {campaigns.length > 0 && (
          <ExportButton
            filename={`kampanii-${projectId.slice(0, 8)}`}
            headers={["Кампания", "Цель", "Статус", "Показы", "Клики", "CTR", "Охват", "Результаты", "Цена за результат", "Потрачено"]}
            rows={campExport}
          />
        )}
      </div>
      <CampaignsTable rows={campaigns} />
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: "ink" | "brand";
}) {
  return (
    <div className="rounded-card bg-surface p-5 shadow-soft ring-1 ring-line">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted">{label}</span>
        <Icon className="h-4 w-4 text-faint" />
      </div>
      <div className={`mt-2 text-2xl font-bold ${tone === "brand" ? "text-brand-ink" : "text-ink"}`}>
        {value}
      </div>
    </div>
  );
}
