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
import { LeadAdsSetup } from "@/components/lead-ads-setup";
import { LaunchConfigCard } from "@/components/launch-config";
import { WebLaunch } from "@/components/web-launch";
import { AdsSectionTabs } from "@/components/ads-section-tabs";
import { LaunchedCampaigns } from "@/components/launched-campaigns";
import { AdEconomics } from "@/components/ad-economics";
import { AdLeads } from "@/components/ad-leads";
import { getMetaStatuses, getLeadPages, getLaunchConfig } from "@/app/p/[projectId]/ads/integration-actions";
import { getLaunchedCampaigns, getAdCrmTotals, getAdLeadList } from "@/app/p/[projectId]/ads/launch-actions";
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
  const tab = sp.tab === "launch" || sp.tab === "connections" ? sp.tab : "analytics";

  const supabase = await createClient();

  // Подключённые кабинеты → тянем данные живьём за выбранный период и уровень.
  // Если ничего не подключено — показываем сохранённый демо-снимок (кампании).
  const [statuses, live, leadPages, launch] = await Promise.all([
    getMetaStatuses(projectId),
    getLiveAds(projectId, level, range.from, range.to),
    getLeadPages(projectId),
    getLaunchConfig(projectId),
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

  const launchedCampaigns = tab === "launch" ? await getLaunchedCampaigns(projectId) : [];
  const adTotals = tab === "launch" ? await getAdCrmTotals(projectId) : null;
  const adLeads = tab === "launch" ? await getAdLeadList(projectId) : [];
  const launchSpendTotal = launchedCampaigns.reduce((s, c) => s + c.spend, 0);

  const courseCampaigns = campaigns.filter((c) => c.objective === "course");
  const totalSpend = campaigns.reduce((s, c) => s + Number(c.spend), 0);
  const courseSpend = courseCampaigns.reduce((s, c) => s + Number(c.spend), 0);
  const vacancySpend = campaigns.filter((c) => c.objective === "vacancy").reduce((s, c) => s + Number(c.spend), 0);
  // Все ключевые метрики считаем ТОЛЬКО по курсу (вакансии не учитываем)
  const courseLeads = courseCampaigns.reduce((s, c) => s + Number(c.leads), 0);
  const courseImpr = courseCampaigns.reduce((s, c) => s + Number(c.impressions), 0);
  const courseClicks = courseCampaigns.reduce((s, c) => s + Number(c.clicks), 0);
  const courseCpl = courseLeads > 0 ? courseSpend / courseLeads : 0;
  const cpm = courseImpr > 0 ? (courseSpend / courseImpr) * 1000 : 0;
  const cpc = courseClicks > 0 ? courseSpend / courseClicks : 0;
  const ctr = courseImpr > 0 ? (courseClicks / courseImpr) * 100 : 0;

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
      <PageHeader title="Реклама" subtitle="Кабинеты Meta, запуск кампаний и аналитика — в долларах $">
        {tab === "analytics" && (
          <DateRangePicker preset={range.preset} from={range.from} to={range.to} label={range.label} />
        )}
      </PageHeader>

      <AdsSectionTabs tab={tab} />

      {/* ─────────────── Аналитика ─────────────── */}
      {tab === "analytics" && (
        <>
          <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Всего на рекламу" value={formatUsd(totalSpend)} icon={Megaphone} tone="brand" />
            <StatCard label="На курс" value={formatUsd(courseSpend)} icon={GraduationCap} tone="ink" />
            <StatCard label="На вакансии" value={formatUsd(vacancySpend)} icon={Briefcase} tone="ink" />
            <StatCard
              label={`Лиды курса: ${formatNumber(courseLeads)} · цена`}
              value={courseCpl > 0 ? formatUsd(courseCpl, 2) : "—"}
              icon={Users}
              tone="ink"
            />
          </div>

          {campaigns.length > 0 && (
            <div className="mb-6 flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-muted">Метрики по курсу:</span>
              <Metric label="CPL · за лид" value={formatUsd(courseCpl, 2)} />
              <Metric label="CPM · 1000 показов" value={formatUsd(cpm, 2)} />
              <Metric label="CPC · за клик" value={formatUsd(cpc, 2)} />
              <Metric label="CTR" value={formatPercent(ctr)} />
            </div>
          )}

          {live.errors.length > 0 && (
            <div className="mb-6 rounded-card bg-red-50 px-4 py-3 text-sm text-red-600">
              Ошибка Meta: {live.errors.join("; ")}. Проверьте токен кабинета (мог истечь).
            </div>
          )}

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
                : "Подключите кабинет во вкладке «Подключения» — данные подтянутся автоматически"}
            {level === "ad" && " · видно креативы и лиды по каждому"}
          </p>
          <CampaignsTable rows={campaigns} entityLabel={LEVEL_LABEL[level]} />
        </>
      )}

      {/* ─────────────── Запуск рекламы ─────────────── */}
      {tab === "launch" && (
        courseStatus ? (
          <div className="space-y-4">
            {adTotals && (
              <AdEconomics
                spendUsd={launchSpendTotal}
                leads={adTotals.leads}
                sales={adTotals.sales}
                revenueKzt={adTotals.revenueKzt}
                usdRate={adTotals.usdRate}
              />
            )}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <LaunchConfigCard
                projectId={projectId}
                config={launch.config}
                pages={leadPages}
                defaultDestination={launch.defaultDestination}
              />
              <WebLaunch projectId={projectId} defaultBudget={launch.config.dailyBudgetUsd} />
            </div>
            <LaunchedCampaigns projectId={projectId} campaigns={launchedCampaigns} />
            <AdLeads leads={adLeads} />
          </div>
        ) : (
          <div className="rounded-card border border-dashed border-line bg-surface p-8 text-center text-sm text-muted">
            Сначала подключите рекламный кабинет курса во вкладке{" "}
            <span className="font-semibold text-ink">«Подключения»</span> — после этого здесь появится запуск рекламы.
          </div>
        )
      )}

      {/* ─────────────── Подключения ─────────────── */}
      {tab === "connections" && (
        <div className="space-y-8">
          <div>
            <h2 className="mb-3 text-sm font-semibold text-ink">Рекламные кабинеты Meta</h2>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <MetaIntegration projectId={projectId} purpose="course" title="Курс" status={courseStatus} />
              <MetaIntegration projectId={projectId} purpose="vacancy" title="Вакансии" status={vacancyStatus} />
            </div>
          </div>
          <div>
            <h2 className="mb-3 text-sm font-semibold text-ink">Лид-формы Meta</h2>
            <LeadAdsSetup
              projectId={projectId}
              webhookUrl="https://pulse-drab-chi.vercel.app/api/meta/leads"
              verifyToken={process.env.META_VERIFY_TOKEN ?? ""}
              pages={leadPages}
              connected={statuses.length > 0}
            />
          </div>
        </div>
      )}
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
