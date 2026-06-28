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
  formatUsd,
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
import { getLiveAds, getAdThumbnails } from "@/lib/ads-live";

/**
 * Оценка креатива по расходу/лидам/продажам:
 *  - top  — окупается продажами (ROAS ≥ 1) либо даёт дешёвые лиды;
 *  - weak — расход без лидов либо дорогие лиды;
 *  - ok   — всё остальное.
 * Лиды берём из данных Meta (есть у каждого объявления); продажи/выручку —
 * из CRM по ad_id лида (замкнутый цикл; активируется на заявках с форм Meta).
 */
function classifyCreative(
  spendUsd: number,
  leads: number,
  buyers: number,
  roas: number | null,
  cplUsd: number | null,
  avgCpl: number | null,
): { verdict: CreativeVerdict; hint: string } {
  if (spendUsd <= 0) {
    return buyers > 0
      ? { verdict: "top", hint: "продажи без расхода" }
      : { verdict: "ok", hint: "нет расхода за период" };
  }
  if (leads === 0) return { verdict: "weak", hint: "расход без лидов" };
  if (buyers > 0) {
    if (roas != null && roas >= 1) return { verdict: "top", hint: `ROAS ${roas.toFixed(1).replace(".", ",")}x` };
    return { verdict: "ok", hint: "есть продажи, ROAS < 1" };
  }
  if (avgCpl != null && cplUsd != null) {
    if (cplUsd <= avgCpl * 0.7) return { verdict: "top", hint: "дешёвые лиды" };
    if (cplUsd > avgCpl * 1.5) return { verdict: "weak", hint: "дорогие лиды" };
  }
  return { verdict: "ok", hint: "лиды идут" };
}

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

  // Объявления Meta за период + миниатюры креативов + курс $→₸ + наши лиды с ad_id.
  const [live, thumbs, { data: project }, { data: leadRows }] = await Promise.all([
    getLiveAds(projectId, "ad", range.from, range.to),
    getAdThumbnails(projectId),
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

  // Продажи по лидам, пришедшим за период с объявления (замкнутый цикл)
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

  // Агрегаты CRM по объявлению: покупатели (уникальные лиды с продажей) и выручка
  type Agg = { buyers: Set<string>; revenue: number };
  const byAd = new Map<string, Agg>();
  for (const s of salesRows) {
    if (!s.lead_id) continue;
    const adId = adByLead.get(s.lead_id);
    if (!adId) continue;
    let a = byAd.get(adId);
    if (!a) {
      a = { buyers: new Set(), revenue: 0 };
      byAd.set(adId, a);
    }
    a.revenue += Number(s.amount);
    a.buyers.add(s.lead_id);
  }

  // Объявления курса (воронка продаж). Лиды — из Meta, продажи — из CRM.
  const courseAds = live.campaigns.filter((c) => c.objective === "course");
  const base = courseAds.map((c) => {
    const a = byAd.get(c.id);
    const spendUsd = Number(c.spend);
    const adLeads = Number(c.leads);
    const revenue = a?.revenue ?? 0;
    const spendKzt = spendUsd * usdRate;
    const th = thumbs.get(c.id);
    return {
      id: c.id,
      name: c.name,
      status: c.status,
      thumb: th?.thumb ?? null,
      full: th?.full ?? null,
      spendUsd,
      spendKzt,
      leads: adLeads,
      buyers: a?.buyers.size ?? 0,
      revenue,
      cplUsd: adLeads > 0 ? spendUsd / adLeads : null,
      roas: spendKzt > 0 ? revenue / spendKzt : null,
    };
  });

  const totalSpendUsd = base.reduce((s, r) => s + r.spendUsd, 0);
  const totalSpendKzt = totalSpendUsd * usdRate;
  const totalLeads = base.reduce((s, r) => s + r.leads, 0);
  const totalBuyers = base.reduce((s, r) => s + r.buyers, 0);
  const totalRevenue = base.reduce((s, r) => s + r.revenue, 0);
  const avgCpl = totalLeads > 0 ? totalSpendUsd / totalLeads : null;

  const rows: CreativeRow[] = base
    .map((r) => {
      const { verdict, hint } = classifyCreative(r.spendUsd, r.leads, r.buyers, r.roas, r.cplUsd, avgCpl);
      return { ...r, verdict, verdictHint: hint };
    })
    .sort((a, b) => b.revenue - a.revenue || b.leads - a.leads || b.spendUsd - a.spendUsd);

  const roas = totalSpendKzt > 0 ? totalRevenue / totalSpendKzt : null;
  const cpaUsd = totalBuyers > 0 ? totalSpendUsd / totalBuyers : null;
  const cplUsd = avgCpl;
  const conversion = totalLeads > 0 ? (totalBuyers / totalLeads) * 100 : null;

  // Лучший (по продажам/лидам) и слабый (по слитому расходу) креатив — для плашки
  const best = rows
    .filter((r) => r.verdict === "top")
    .sort((a, b) => b.revenue - a.revenue || b.leads - a.leads)[0] ?? null;
  const worst = rows
    .filter((r) => r.verdict === "weak")
    .sort((a, b) => b.spendUsd - a.spendUsd)[0] ?? null;

  const exportRows = rows.map((r) => [
    r.name,
    r.leads,
    r.cplUsd != null ? r.cplUsd.toFixed(2) : "—",
    r.buyers,
    Math.round(r.revenue),
    r.spendUsd.toFixed(2),
    r.roas != null ? r.roas.toFixed(2) : "—",
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
              value={formatUsd(totalSpendUsd, 2)}
              hint={`≈ ${formatCurrencyShort(totalSpendKzt)} · курс 1 $ = ${usdRate} ₸`}
              icon={Megaphone}
            />
            <MetricCard label="Лиды (Meta)" value={formatNumber(totalLeads)} icon={Users} />
            <MetricCard label="Продажи" value={formatNumber(totalBuyers)} icon={ShoppingBag} />
            <MetricCard label="Выручка" value={formatCurrencyShort(totalRevenue)} accent icon={Coins} />
          </div>

          <div className="mb-6 flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-muted">Итоги по курсу:</span>
            <Metric label="ROAS · возврат на рекламу" value={roas != null ? `${roas.toFixed(1).replace(".", ",")}x` : "—"} />
            <Metric label="CPA · за продажу" value={cpaUsd != null ? formatUsd(cpaUsd, 2) : "—"} />
            <Metric label="CPL · за лид" value={cplUsd != null ? formatUsd(cplUsd, 2) : "—"} />
            <Metric label="Конверсия в продажу" value={conversion != null ? formatPercent(conversion) : "—"} />
          </div>

          {(best || worst) && (
            <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {best && (
                <div className="rounded-card border border-brand-soft bg-brand-soft/40 p-4">
                  <div className="text-xs font-medium text-brand-ink">🏆 Лучший креатив</div>
                  <div className="mt-1 font-semibold text-ink">{best.name}</div>
                  <div className="mt-1 text-sm text-muted">
                    {best.buyers > 0
                      ? `${formatNumber(best.buyers)} продаж · ${formatCurrency(best.revenue)} выручки${
                          best.roas != null ? ` · ROAS ${best.roas.toFixed(1).replace(".", ",")}x` : ""
                        }`
                      : `${formatNumber(best.leads)} лидов · цена лида ${best.cplUsd != null ? formatUsd(best.cplUsd, 2) : "—"}`}
                  </div>
                </div>
              )}
              {worst && (
                <div className="rounded-card border border-red-100 bg-red-50/60 p-4">
                  <div className="text-xs font-medium text-red-600">⚠️ Слабый креатив</div>
                  <div className="mt-1 font-semibold text-ink">{worst.name}</div>
                  <div className="mt-1 text-sm text-muted">
                    Расход {formatUsd(worst.spendUsd, 2)} · {formatNumber(worst.leads)} лидов · {worst.verdictHint}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-muted">
              <p>
                {rows.length > 0
                  ? `${formatNumber(rows.length)} объявлений · ${range.label}`
                  : `За период «${range.label}» данных по объявлениям нет`}
              </p>
              <p className="mt-0.5">
                Расход и цена лида — в долларах (валюта кабинета). Итого расход ≈ {formatCurrency(totalSpendKzt)} по курсу{" "}
                1 $ = {usdRate} ₸. Продажи привязываются к креативу по заявкам с форм Meta (Lead Ads).
              </p>
            </div>
            {rows.length > 0 && (
              <ExportButton
                filename={`creatives-${projectId.slice(0, 8)}`}
                headers={["Объявление", "Лиды", "Цена лида $", "Продажи", "Выручка ₸", "Расход $", "ROAS", "Оценка"]}
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
