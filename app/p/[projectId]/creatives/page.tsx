import Link from "next/link";
import { Megaphone, Users, ShoppingBag, Coins } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireAccess } from "@/lib/queries";
import { rangeFromSearchParams, rangeEndExclusive } from "@/lib/date-range";
import {
  formatCurrency,
  formatCurrencyShort,
  formatNumber,
  formatPercent,
} from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { DateRangePicker } from "@/components/date-range-picker";
import { ExportButton } from "@/components/export-button";
import { MetricCard } from "@/components/metric-card";
import {
  CreativesTable,
  VERDICT_META,
  type CreativeRow,
  type CreativeVerdict,
} from "@/components/creatives-table";
import { getLiveAds } from "@/lib/ads-live";

/**
 * Оценка креатива по расходу/лидам/продажам:
 *  - top  — окупается (ROAS ≥ 1) или есть продажи без расхода;
 *  - weak — расход без лидов, либо дорогие лиды без продаж;
 *  - ok   — всё остальное (лиды идут, продаж пока нет / ROAS < 1).
 */
function classifyCreative(
  spendKzt: number,
  crmLeads: number,
  buyers: number,
  revenue: number,
  avgCpl: number | null,
): { verdict: CreativeVerdict; hint: string } {
  if (spendKzt === 0) {
    return buyers > 0
      ? { verdict: "top", hint: "продажи без расхода" }
      : { verdict: "ok", hint: "нет расхода за период" };
  }
  if (crmLeads === 0) return { verdict: "weak", hint: "расход без лидов" };
  const roas = revenue / spendKzt;
  if (roas >= 1) return { verdict: "top", hint: `ROAS ${roas.toFixed(1).replace(".", ",")}x` };
  if (buyers > 0) return { verdict: "ok", hint: "есть продажи, ROAS < 1" };
  const cpl = spendKzt / crmLeads;
  if (avgCpl != null && cpl > avgCpl * 1.5) {
    return { verdict: "weak", hint: "дорогие лиды, нет продаж" };
  }
  return { verdict: "ok", hint: "лиды есть, продаж пока нет" };
}

/**
 * Аналитика креативов: какое объявление приносит лиды и реальные продажи.
 * Расход берём из Meta на уровне объявлений (живьём за период), продажи —
 * из CRM по ad_id лида (замкнутый цикл реклама → продажа). Расход $ → ₸
 * по курсу проекта (usd_rate), как в «Финансах», чтобы ROAS считался в одной валюте.
 */
export default async function CreativesPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { projectId } = await params;
  await requireAccess(projectId, "creatives");
  const sp = await searchParams;
  const range = rangeFromSearchParams(sp);

  const supabase = await createClient();

  // Объявления Meta за период + курс $→₸ + наши лиды с привязкой к объявлению.
  const [live, { data: project }, { data: leadRows }] = await Promise.all([
    getLiveAds(projectId, "ad", range.from, range.to),
    supabase.from("projects").select("usd_rate").eq("id", projectId).maybeSingle(),
    supabase
      .from("leads")
      .select("id, ad_id")
      .eq("project_id", projectId)
      .not("ad_id", "is", null)
      .gte("created_at", range.from)
      .lt("created_at", rangeEndExclusive(range)),
  ]);

  const usdRate = Number(project?.usd_rate ?? 500);
  const leads = leadRows ?? [];

  // leadId → adId, чтобы привязать продажи к объявлению
  const adByLead = new Map<string, string>();
  for (const l of leads) if (l.ad_id) adByLead.set(l.id, l.ad_id);

  // Продажи по лидам, пришедшим за период с объявления
  let salesRows: { lead_id: string | null; amount: number }[] = [];
  const leadIds = leads.map((l) => l.id);
  if (leadIds.length > 0) {
    const { data } = await supabase
      .from("sales")
      .select("lead_id, amount")
      .eq("project_id", projectId)
      .in("lead_id", leadIds);
    salesRows = (data ?? []) as { lead_id: string | null; amount: number }[];
  }

  // Агрегаты по объявлению: лиды, покупатели (уникальные лиды с продажей), выручка
  type Agg = { crmLeads: number; buyers: Set<string>; revenue: number };
  const byAd = new Map<string, Agg>();
  const ensure = (adId: string): Agg => {
    let a = byAd.get(adId);
    if (!a) {
      a = { crmLeads: 0, buyers: new Set(), revenue: 0 };
      byAd.set(adId, a);
    }
    return a;
  };
  for (const l of leads) if (l.ad_id) ensure(l.ad_id).crmLeads += 1;
  for (const s of salesRows) {
    if (!s.lead_id) continue;
    const adId = adByLead.get(s.lead_id);
    if (!adId) continue;
    const a = ensure(adId);
    a.revenue += Number(s.amount);
    a.buyers.add(s.lead_id);
  }

  // Объявления курса (воронка продаж) + наши продажи по ним
  const courseAds = live.campaigns.filter((c) => c.objective === "course");
  const base = courseAds.map((c) => {
    const a = byAd.get(c.id);
    const spendKzt = Number(c.spend) * usdRate;
    const crmLeads = a?.crmLeads ?? 0;
    return {
      id: c.id,
      name: c.name,
      status: c.status,
      spendKzt,
      crmLeads,
      buyers: a?.buyers.size ?? 0,
      revenue: a?.revenue ?? 0,
      cpl: crmLeads > 0 ? spendKzt / crmLeads : null,
    };
  });

  const totalSpend = base.reduce((s, r) => s + r.spendKzt, 0);
  const totalLeads = base.reduce((s, r) => s + r.crmLeads, 0);
  const totalBuyers = base.reduce((s, r) => s + r.buyers, 0);
  const totalRevenue = base.reduce((s, r) => s + r.revenue, 0);
  const avgCpl = totalLeads > 0 ? totalSpend / totalLeads : null;

  const rows: CreativeRow[] = base
    .map((r) => {
      const { verdict, hint } = classifyCreative(r.spendKzt, r.crmLeads, r.buyers, r.revenue, avgCpl);
      return { ...r, verdict, verdictHint: hint };
    })
    .sort((a, b) => b.revenue - a.revenue || b.spendKzt - a.spendKzt);

  const roas = totalSpend > 0 ? totalRevenue / totalSpend : null;
  const cpa = totalBuyers > 0 ? totalSpend / totalBuyers : null;
  const cpl = avgCpl;
  const conversion = totalLeads > 0 ? (totalBuyers / totalLeads) * 100 : null;

  // Лучший (по выручке) и слабый (по слитому расходу) креатив — для плашки
  const best = rows.filter((r) => r.verdict === "top").sort((a, b) => b.revenue - a.revenue)[0] ?? null;
  const worst = rows.filter((r) => r.verdict === "weak").sort((a, b) => b.spendKzt - a.spendKzt)[0] ?? null;

  const exportRows = rows.map((r) => [
    r.name,
    r.crmLeads,
    r.cpl != null ? Math.round(r.cpl) : "—",
    r.buyers,
    Math.round(r.revenue),
    Math.round(r.spendKzt),
    r.spendKzt > 0 ? (r.revenue / r.spendKzt).toFixed(2) : "—",
    VERDICT_META[r.verdict].label,
  ]);

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <PageHeader
        title="Аналитика креативов"
        subtitle="Какие объявления приносят лиды и реальные продажи — замкнутый цикл реклама → продажа"
      >
        <DateRangePicker preset={range.preset} from={range.from} to={range.to} label={range.label} />
      </PageHeader>

      {!live.connected ? (
        <div className="rounded-card border border-dashed border-line bg-surface px-6 py-12 text-center">
          <Megaphone className="mx-auto h-8 w-8 text-faint" />
          <p className="mx-auto mt-3 max-w-md text-sm text-muted">
            Подключите рекламный кабинет Meta на странице{" "}
            <Link href={`/p/${projectId}/ads`} className="font-medium text-brand-ink underline">
              Реклама
            </Link>{" "}
            — и здесь появится разбивка по объявлениям с лидами, продажами и ROAS.
          </p>
        </div>
      ) : (
        <>
          {live.errors.length > 0 && (
            <div className="mb-6 rounded-card bg-red-50 px-4 py-3 text-sm text-red-600">
              Ошибка Meta: {live.errors.join("; ")}. Проверьте токен кабинета (мог истечь).
            </div>
          )}

          <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <MetricCard
              label="Расход на курс"
              value={formatCurrencyShort(totalSpend)}
              hint={`курс $ = ${usdRate} ₸`}
              icon={Megaphone}
            />
            <MetricCard label="Лиды (CRM)" value={formatNumber(totalLeads)} icon={Users} />
            <MetricCard label="Продажи" value={formatNumber(totalBuyers)} icon={ShoppingBag} />
            <MetricCard label="Выручка" value={formatCurrencyShort(totalRevenue)} accent icon={Coins} />
          </div>

          <div className="mb-6 flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-muted">Итоги по курсу:</span>
            <Metric label="ROAS · возврат на рекламу" value={roas != null ? `${roas.toFixed(1).replace(".", ",")}x` : "—"} />
            <Metric label="CPA · за продажу" value={cpa != null ? formatCurrency(cpa) : "—"} />
            <Metric label="CPL · за лид" value={cpl != null ? formatCurrency(cpl) : "—"} />
            <Metric label="Конверсия в продажу" value={conversion != null ? formatPercent(conversion) : "—"} />
          </div>

          {(best || worst) && (
            <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {best && (
                <div className="rounded-card border border-brand-soft bg-brand-soft/40 p-4">
                  <div className="text-xs font-medium text-brand-ink">🏆 Лучший креатив</div>
                  <div className="mt-1 font-semibold text-ink">{best.name}</div>
                  <div className="mt-1 text-sm text-muted">
                    {formatNumber(best.buyers)} продаж · {formatCurrency(best.revenue)} выручки
                    {best.spendKzt > 0 &&
                      ` · ROAS ${(best.revenue / best.spendKzt).toFixed(1).replace(".", ",")}x`}
                  </div>
                </div>
              )}
              {worst && (
                <div className="rounded-card border border-red-100 bg-red-50/60 p-4">
                  <div className="text-xs font-medium text-red-600">⚠️ Слабый креатив</div>
                  <div className="mt-1 font-semibold text-ink">{worst.name}</div>
                  <div className="mt-1 text-sm text-muted">
                    Расход {formatCurrency(worst.spendKzt)} · {formatNumber(worst.crmLeads)} лидов · {worst.verdictHint}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted">
              {rows.length > 0
                ? `${formatNumber(rows.length)} объявлений · ${range.label}`
                : `За период «${range.label}» данных по объявлениям нет`}
              {" · продажи учтены по лидам, пришедшим с объявления за период"}
            </p>
            {rows.length > 0 && (
              <ExportButton
                filename={`creatives-${projectId.slice(0, 8)}`}
                headers={["Объявление", "Лиды", "Цена лида ₸", "Продажи", "Выручка ₸", "Расход ₸", "ROAS", "Оценка"]}
                rows={exportRows}
              />
            )}
          </div>

          <CreativesTable rows={rows} />
        </>
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
