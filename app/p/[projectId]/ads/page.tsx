import { Megaphone, GraduationCap, Briefcase, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireAccess } from "@/lib/queries";
import { rangeFromSearchParams } from "@/lib/date-range";
import { objectiveLabel } from "@/lib/ads";
import { formatUsd, formatNumber, formatPercent } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { DateRangePicker } from "@/components/date-range-picker";
import { ExportButton } from "@/components/export-button";
import { CampaignsTable, type CampaignRow } from "@/components/campaigns-table";
import { AdsTabs } from "@/components/ads-tabs";
import { MetaIntegration } from "@/components/meta-integration";
import { getMetaStatuses } from "@/app/p/[projectId]/ads/integration-actions";
import { getLiveAds } from "@/lib/ads-live";
import type { AdLevel } from "@/lib/meta";

const LEVEL_LABEL: Record<AdLevel, string> = {
  campaign: "Кампания",
  adset: "Группа объявлений",
  ad: "Объявление",
};

export default async function AdsPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { projectId } = await params;
  await requireAccess(projectId, "ads");
  const sp = await searchParams;
  const range = rangeFromSearchParams(sp);
  const levelParam = typeof sp.level === "string" ? sp.level : "campaign";
  const level: AdLevel = levelParam === "adset" || levelParam === "ad" ? levelParam : "campaign";

  const supabase = await createClient();

  // Подключённые кабинеты → тянем данные живьём за выбранный период и уровень.
  // Если ничего не подключено — показываем сохранённый демо-снимок (кампании).
  const [statuses, live] = await Promise.all([
    getMetaStatuses(projectId),
    getLiveAds(projectId, level, range.from, range.to),
  ]);

  let campaigns: CampaignRow[];
  if (live.connected) {
    campaigns = live.campaigns;
  } else {
    const { data } = await supabase
      .from("ad_campaigns")
      .select("id, name, objective, status, spend, impressions, clicks, reach, leads")
      .eq("project_id", projectId)
      .order("spend", { ascending: false });
    campaigns = (data ?? []) as CampaignRow[];
  }

  const courseStatus = statuses.find((s) => s.purpose === "course") ?? null;
  const vacancyStatus = statuses.find((s) => s.purpose === "vacancy") ?? null;

  const totalSpend = campaigns.reduce((s, c) => s + Number(c.spend), 0);
  const courseSpend = campaigns.filter((c) => c.objective === "course").reduce((s, c) => s + Number(c.spend), 0);
  const vacancySpend = campaigns.filter((c) => c.objective === "vacancy").reduce((s, c) => s + Number(c.spend), 0);
  const totalLeads = campaigns.reduce((s, c) => s + Number(c.leads), 0);
  const totalImpr = campaigns.reduce((s, c) => s + Number(c.impressions), 0);
  const totalClicks = campaigns.reduce((s, c) => s + Number(c.clicks), 0);
  const cpl = totalLeads > 0 ? totalSpend / totalLeads : 0;
  const cpm = totalImpr > 0 ? (totalSpend / totalImpr) * 1000 : 0;
  const cpc = totalClicks > 0 ? totalSpend / totalClicks : 0;
  const ctr = totalImpr > 0 ? (totalClicks / totalImpr) * 100 : 0;

  const round2 = (v: number) => Math.round(v * 100) / 100;
  const campExport = campaigns.map((c) => [
    c.name,
    objectiveLabel(c.objective),
    c.status === "active" ? "Активна" : "Пауза",
    c.leads,
    c.leads > 0 ? round2(c.spend / c.leads) : 0, // CPL $
    c.impressions > 0 ? round2((c.spend / c.impressions) * 1000) : 0, // CPM $
    c.clicks > 0 ? round2(c.spend / c.clicks) : 0, // CPC $
    c.impressions > 0 ? `${((c.clicks / c.impressions) * 100).toFixed(2)}%` : "—", // CTR
    c.reach,
    c.impressions,
    c.clicks,
    round2(c.spend), // Потрачено $
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

      {campaigns.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-2">
          <Metric label="CPL · за лид" value={formatUsd(cpl, 2)} />
          <Metric label="CPM · за 1000 показов" value={formatUsd(cpm, 2)} />
          <Metric label="CPC · за клик" value={formatUsd(cpc, 2)} />
          <Metric label="CTR" value={formatPercent(ctr)} />
        </div>
      )}

      {live.errors.length > 0 && (
        <div className="mb-6 rounded-card bg-red-50 px-4 py-3 text-sm text-red-600">
          Ошибка Meta: {live.errors.join("; ")}. Проверьте токен кабинета (мог истечь).
        </div>
      )}

      {/* Два рекламных кабинета: курс и вакансии */}
      <div className="mb-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <MetaIntegration projectId={projectId} purpose="course" title="Курс" status={courseStatus} />
        <MetaIntegration projectId={projectId} purpose="vacancy" title="Вакансии" status={vacancyStatus} />
      </div>

      {/* Уровни как в Ads Manager: кампании / группы / объявления */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <AdsTabs level={level} />
        {campaigns.length > 0 && (
          <ExportButton
            filename={`${level}-${projectId.slice(0, 8)}`}
            headers={["Название", "Цель", "Статус", "Лиды", "CPL $", "CPM $", "CPC $", "CTR", "Охват", "Показы", "Клики", "Потрачено $"]}
            rows={campExport}
          />
        )}
      </div>
      <p className="mb-3 text-xs text-muted">
        {campaigns.length > 0
          ? `${campaigns.length} · ${range.label}`
          : live.connected
            ? `За период «${range.label}» данных нет`
            : "Подключите кабинет — данные подтянутся автоматически"}
        {level === "ad" && " · видно креативы и лиды по каждому"}
      </p>
      <CampaignsTable rows={campaigns} entityLabel={LEVEL_LABEL[level]} />
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="inline-flex items-baseline gap-2 rounded-xl bg-surface px-3.5 py-2 shadow-soft ring-1 ring-line">
      <span className="text-xs text-muted">{label}</span>
      <span className="text-sm font-bold text-ink">{value}</span>
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
