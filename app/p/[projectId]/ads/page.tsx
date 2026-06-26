import { Megaphone, GraduationCap, Briefcase, Users, Plug } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireAccess } from "@/lib/queries";
import { rangeFromSearchParams } from "@/lib/date-range";
import { localDay } from "@/lib/attendance";
import { channelShort, objectiveLabel } from "@/lib/ads";
import { formatCurrency, formatNumber } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { DateRangePicker } from "@/components/date-range-picker";
import { ExportButton } from "@/components/export-button";
import { AdSpendForm } from "@/components/ad-spend-form";
import { AdSpendList, type AdRow } from "@/components/ad-spend-list";

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
  const { data } = await supabase
    .from("ad_spend")
    .select("id, channel, objective, campaign, amount, spent_on, leads, note")
    .eq("project_id", projectId)
    .gte("spent_on", range.from)
    .lte("spent_on", range.to)
    .order("spent_on", { ascending: false });

  const rows = (data ?? []) as AdRow[];
  const total = rows.reduce((s, r) => s + Number(r.amount), 0);
  const courseSpend = rows.filter((r) => r.objective === "course").reduce((s, r) => s + Number(r.amount), 0);
  const vacancySpend = rows.filter((r) => r.objective === "vacancy").reduce((s, r) => s + Number(r.amount), 0);
  const totalLeads = rows.reduce((s, r) => s + Number(r.leads), 0);
  const cpl = totalLeads > 0 ? total / totalLeads : 0;

  // Разбивка по каналам
  const byChannel = new Map<string, number>();
  for (const r of rows) byChannel.set(r.channel, (byChannel.get(r.channel) ?? 0) + Number(r.amount));
  const channels = [...byChannel.entries()]
    .map(([key, sum]) => ({ key, sum, pct: total > 0 ? (sum / total) * 100 : 0 }))
    .sort((a, b) => b.sum - a.sum);

  const exportRows = rows.map((r) => [
    r.spent_on,
    channelShort(r.channel),
    objectiveLabel(r.objective),
    r.campaign,
    r.leads,
    r.leads > 0 ? Math.round(r.amount / r.leads) : 0,
    Math.round(r.amount),
    r.note ?? "",
  ]);

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <PageHeader title="Реклама" subtitle={`Таргетинг и рекламный бюджет · период: ${range.label}`}>
        <div className="flex items-center gap-2">
          <ExportButton
            filename={`reklama-${range.from}_${range.to}`}
            headers={["Дата", "Канал", "Цель", "Кампания", "Лидов", "Цена лида", "Расход", "Комментарий"]}
            rows={exportRows}
          />
          <DateRangePicker preset={range.preset} from={range.from} to={range.to} label={range.label} />
        </div>
      </PageHeader>

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Всего на рекламу" value={formatCurrency(total)} icon={Megaphone} tone="brand" />
        <StatCard label="На курс" value={formatCurrency(courseSpend)} icon={GraduationCap} tone="ink" />
        <StatCard label="На вакансии" value={formatCurrency(vacancySpend)} icon={Briefcase} tone="ink" />
        <StatCard
          label={`Лидов: ${formatNumber(totalLeads)} · цена`}
          value={cpl > 0 ? formatCurrency(cpl) : "—"}
          icon={Users}
          tone="ink"
        />
      </div>

      {/* Подключение рекламного кабинета (реальная интеграция — на этапе интеграций) */}
      <div className="mb-6 flex flex-col gap-3 rounded-card border border-dashed border-line bg-surface p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-soft text-brand-ink">
            <Plug className="h-5 w-5" />
          </span>
          <div>
            <div className="text-sm font-semibold text-ink">Рекламный кабинет Meta Ads</div>
            <p className="mt-0.5 max-w-xl text-sm text-muted">
              После подключения расходы и лиды будут подтягиваться автоматически. Токен
              доступа хранится только на сервере. Пока вносите расходы вручную ниже — они
              сразу попадают в «Финансы».
            </p>
          </div>
        </div>
        <button
          type="button"
          disabled
          className="shrink-0 cursor-not-allowed rounded-lg bg-canvas px-4 py-2 text-sm font-medium text-faint ring-1 ring-line"
        >
          Скоро
        </button>
      </div>

      <div className="mb-6">
        <AdSpendForm projectId={projectId} today={localDay()} />
      </div>

      {channels.length > 0 && (
        <div className="mb-6 rounded-card bg-surface p-6 shadow-soft ring-1 ring-line">
          <h2 className="mb-4 text-base font-semibold text-ink">Расходы по каналам</h2>
          <div className="space-y-3">
            {channels.map((c) => (
              <div key={c.key}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="text-muted">{channelShort(c.key)}</span>
                  <span className="font-medium text-ink">{formatCurrency(c.sum)}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-canvas">
                  <div className="h-full rounded-full bg-brand" style={{ width: `${Math.max(c.pct, 2)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <h2 className="mb-3 text-base font-semibold text-ink">Расходы на рекламу</h2>
      <AdSpendList projectId={projectId} rows={rows} />
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
