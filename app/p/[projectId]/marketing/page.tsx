import Link from "next/link";
import { Megaphone, Users, Tag, Gauge, MousePointerClick, ShoppingBag, Coins, TrendingUp, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getProject, requireAccess } from "@/lib/queries";
import { getNiche } from "@/lib/niches";
import { rangeFromSearchParams, rangeEndExclusive } from "@/lib/date-range";
import { formatCurrency, formatCurrencyShort, formatNumber, formatPercent, formatUsd } from "@/lib/format";
import { getCohortFunnel } from "@/lib/funnel";
import { getLiveAds } from "@/lib/ads-live";
import { PageHeader } from "@/components/page-header";
import { DateRangePicker } from "@/components/date-range-picker";
import { MetricCard } from "@/components/metric-card";
import { FunnelCard } from "@/components/funnel-card";

/**
 * Marketing Dashboard — командный центр маркетинга: полная цепочка
 * деньги → лиды → продажи, сплит бюджета (курс/вакансии), эффективность
 * и быстрые ссылки на детали (Реклама, Аналитика креативов, CAPI).
 * Расход Meta в $ (валюта кабинета), ROAS — в ₸ по курсу проекта.
 */
export default async function MarketingPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { projectId } = await params;
  await requireAccess(projectId, "marketing");
  const range = rangeFromSearchParams(await searchParams);

  const supabase = await createClient();
  const project = await getProject(projectId);
  const niche = getNiche(project?.niche);

  const [{ data: proj }, { data: sales }, live, funnel] = await Promise.all([
    supabase.from("projects").select("usd_rate").eq("id", projectId).maybeSingle(),
    supabase
      .from("sales")
      .select("amount")
      .eq("project_id", projectId)
      .gte("created_at", range.from)
      .lt("created_at", rangeEndExclusive(range)),
    getLiveAds(projectId, "campaign", range.from, range.to),
    getCohortFunnel(projectId, niche.key, range),
  ]);

  const usdRate = Number(proj?.usd_rate ?? 500);
  const salesArr = sales ?? [];
  const salesCount = salesArr.length;
  const revenue = salesArr.reduce((s, x) => s + Number(x.amount), 0);

  const course = live.campaigns.filter((c) => c.objective === "course");
  const vacancy = live.campaigns.filter((c) => c.objective === "vacancy");

  const sum = (rows: typeof live.campaigns, key: "spend" | "leads" | "impressions" | "clicks") =>
    rows.reduce((s, c) => s + Number(c[key]), 0);

  const courseSpendUsd = sum(course, "spend");
  const courseLeads = sum(course, "leads");
  const courseImpr = sum(course, "impressions");
  const courseClicks = sum(course, "clicks");
  const vacancySpendUsd = sum(vacancy, "spend");
  const vacancyLeads = sum(vacancy, "leads");

  const courseSpendKzt = courseSpendUsd * usdRate;
  const cplUsd = courseLeads > 0 ? courseSpendUsd / courseLeads : null;
  const cpm = courseImpr > 0 ? (courseSpendUsd / courseImpr) * 1000 : null;
  const ctr = courseImpr > 0 ? (courseClicks / courseImpr) * 100 : null;
  const roas = courseSpendKzt > 0 ? revenue / courseSpendKzt : null;

  // Лучший / худший по цене лида (среди объявлений курса с лидами)
  const withCpl = course
    .filter((c) => Number(c.leads) > 0 && Number(c.spend) > 0)
    .map((c) => ({ name: c.name, cpl: Number(c.spend) / Number(c.leads), leads: Number(c.leads) }));
  const best = [...withCpl].sort((a, b) => a.cpl - b.cpl)[0] ?? null;
  const worst = [...withCpl].sort((a, b) => b.cpl - a.cpl)[0] ?? null;

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <PageHeader title="Marketing Dashboard" subtitle={`Маркетинг: деньги → лиды → продажи · период: ${range.label}`}>
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
            — и здесь появится сводка по маркетингу.
          </p>
        </div>
      ) : (
        <>
          {live.errors.length > 0 && (
            <div className="mb-6 rounded-card bg-red-50 px-4 py-3 text-sm text-red-600">
              Ошибка Meta: {live.errors.join("; ")}. Проверьте токен кабинета (мог истечь).
            </div>
          )}

          {/* Полная цепочка: деньги → лиды → продажи */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <MetricCard
              label="Расход на курс"
              value={formatUsd(courseSpendUsd, 2)}
              hint={`≈ ${formatCurrencyShort(courseSpendKzt)} · курс ${usdRate} ₸`}
              icon={Megaphone}
            />
            <MetricCard label="Лиды курса" value={formatNumber(courseLeads)} icon={Users} />
            <MetricCard label="Цена лида" value={cplUsd != null ? formatUsd(cplUsd, 2) : "—"} icon={Tag} />
            <MetricCard label="CPM · 1000 показов" value={cpm != null ? formatUsd(cpm, 2) : "—"} icon={Gauge} />
            <MetricCard label="CTR" value={ctr != null ? formatPercent(ctr) : "—"} icon={MousePointerClick} />
            <MetricCard label="Продажи" value={formatNumber(salesCount)} icon={ShoppingBag} />
            <MetricCard label="Выручка" value={formatCurrencyShort(revenue)} accent icon={Coins} />
            <MetricCard label="ROAS" value={roas != null ? `${roas.toFixed(1).replace(".", ",")}x` : "—"} icon={TrendingUp} />
          </div>

          {/* Сплит бюджета: курс vs вакансии */}
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <SplitCard title="Бюджет на курс" spendUsd={courseSpendUsd} spendKzt={courseSpendKzt} leads={courseLeads} accent />
            <SplitCard
              title="Бюджет на вакансии"
              spendUsd={vacancySpendUsd}
              spendKzt={vacancySpendUsd * usdRate}
              leads={vacancyLeads}
            />
          </div>

          {/* Лучший / худший по цене лида */}
          {(best || worst) && (
            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {best && (
                <div className="rounded-card border border-brand-soft bg-brand-soft/40 p-4">
                  <div className="text-xs font-medium text-brand-ink">🏆 Самый дешёвый лид</div>
                  <div className="mt-1 font-semibold text-ink">{best.name}</div>
                  <div className="mt-1 text-sm text-muted">
                    {formatUsd(best.cpl, 2)} за лид · {formatNumber(best.leads)} лидов
                  </div>
                </div>
              )}
              {worst && (
                <div className="rounded-card border border-red-100 bg-red-50/60 p-4">
                  <div className="text-xs font-medium text-red-600">⚠️ Самый дорогой лид</div>
                  <div className="mt-1 font-semibold text-ink">{worst.name}</div>
                  <div className="mt-1 text-sm text-muted">
                    {formatUsd(worst.cpl, 2)} за лид · {formatNumber(worst.leads)} лидов
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Воронка + быстрые ссылки на детали */}
          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="rounded-card bg-surface p-6 shadow-soft ring-1 ring-line lg:col-span-1">
              <h2 className="text-base font-semibold text-ink">Воронка</h2>
              <p className="mb-5 mt-0.5 text-xs text-faint">Из лидов за период — сколько дошло до этапа</p>
              <FunnelCard stages={funnel} />
            </div>

            <div className="lg:col-span-2">
              <h2 className="mb-3 text-base font-semibold text-ink">Подробнее</h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <DetailLink href={`/p/${projectId}/ads`} title="Реклама" desc="Кампании, расход, метрики" />
                <DetailLink href={`/p/${projectId}/creatives`} title="Аналитика креативов" desc="Объявления → продажи, ROAS" />
                <DetailLink href={`/p/${projectId}/capi`} title="CAPI" desc="Покупки в Meta, lookalike" />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function SplitCard({
  title,
  spendUsd,
  spendKzt,
  leads,
  accent,
}: {
  title: string;
  spendUsd: number;
  spendKzt: number;
  leads: number;
  accent?: boolean;
}) {
  const cpl = leads > 0 ? spendUsd / leads : null;
  return (
    <div className={`rounded-card p-5 shadow-soft ring-1 ${accent ? "bg-brand-soft/40 ring-brand-soft" : "bg-surface ring-line"}`}>
      <div className="text-sm font-semibold text-ink">{title}</div>
      <div className="mt-3 flex items-end justify-between gap-4">
        <div>
          <div className="text-2xl font-bold tracking-tight text-ink">{formatUsd(spendUsd, 2)}</div>
          <div className="mt-0.5 text-xs text-muted">≈ {formatCurrency(spendKzt)}</div>
        </div>
        <div className="text-right text-sm">
          <div className="text-muted">
            Лиды: <span className="font-semibold text-ink">{formatNumber(leads)}</span>
          </div>
          <div className="text-muted">
            Цена лида: <span className="font-semibold text-ink">{cpl != null ? formatUsd(cpl, 2) : "—"}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailLink({ href, title, desc }: { href: string; title: string; desc: string }) {
  return (
    <Link
      href={href}
      className="group flex items-center justify-between gap-2 rounded-card bg-surface p-4 shadow-soft ring-1 ring-line transition hover:ring-brand/40"
    >
      <div>
        <div className="text-sm font-semibold text-ink">{title}</div>
        <div className="mt-0.5 text-xs text-muted">{desc}</div>
      </div>
      <ArrowRight className="h-4 w-4 shrink-0 text-faint transition group-hover:text-brand-ink" />
    </Link>
  );
}
