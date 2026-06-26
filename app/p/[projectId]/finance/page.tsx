import { TrendingUp, TrendingDown, Wallet, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireAccess } from "@/lib/queries";
import { rangeFromSearchParams, rangeEndExclusive } from "@/lib/date-range";
import { localDay } from "@/lib/attendance";
import { channelShort, objectiveLabel } from "@/lib/ads";
import {
  categoryLabel,
  currentPeriod,
  periodLabel,
  payrollTotal,
  kindLabel,
} from "@/lib/finance";
import { formatCurrency, formatUsd } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { DateRangePicker } from "@/components/date-range-picker";
import { ExportButton } from "@/components/export-button";
import { FinanceForm } from "@/components/finance-form";
import { FinanceLedger, type LedgerRow } from "@/components/finance-ledger";
import { UsdRateEditor } from "@/components/usd-rate-editor";
import { getLiveAds } from "@/lib/ads-live";

export default async function FinancePage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { projectId } = await params;
  await requireAccess(projectId, "finance");
  const range = rangeFromSearchParams(await searchParams);

  const supabase = await createClient();
  const period = currentPeriod();

  const [{ data: entries }, { data: salesRows }, { data: payrolls }, { data: project }, live] =
    await Promise.all([
      supabase
        .from("finance_entries")
        .select("id, kind, category, title, amount, spent_on, note")
        .eq("project_id", projectId)
        .gte("spent_on", range.from)
        .lte("spent_on", range.to)
        .order("spent_on", { ascending: false }),
      supabase
        .from("sales")
        .select("amount")
        .eq("project_id", projectId)
        .gte("created_at", range.from)
        .lt("created_at", rangeEndExclusive(range)),
      supabase
        .from("payroll")
        .select("base_salary, days_planned, days_worked, kpi_bonus, bonus, deduction")
        .eq("project_id", projectId)
        .eq("period", period),
      supabase.from("projects").select("usd_rate").eq("id", projectId).maybeSingle(),
      getLiveAds(projectId, range.from, range.to),
    ]);

  const usdRate = Number(project?.usd_rate ?? 500);
  const manual = (entries ?? []) as LedgerRow[];

  // Реклама (в валюте кабинета, обычно USD) → переводим в ₸ по курсу проекта.
  // Подключён кабинет → живые данные за период; иначе — сохранённый снимок.
  let adSpendUsd = 0;
  let adAsLedger: LedgerRow[] = [];
  if (live.connected) {
    adAsLedger = live.campaigns.map((c) => {
      adSpendUsd += Number(c.spend);
      return {
        id: c.id,
        kind: "expense",
        category: "ad_spend",
        title: `Meta · ${c.name}`,
        amount: Number(c.spend) * usdRate,
        spent_on: range.to,
        note: `${objectiveLabel(c.objective)} · ${formatUsd(Number(c.spend))}`,
        locked: true,
      };
    });
  } else {
    const { data: adRows } = await supabase
      .from("ad_spend")
      .select("id, channel, objective, campaign, amount, currency, spent_on")
      .eq("project_id", projectId)
      .gte("spent_on", range.from)
      .lte("spent_on", range.to);
    adAsLedger = (adRows ?? []).map((a) => {
      const native = Number(a.amount);
      const kzt = a.currency === "USD" ? native * usdRate : native;
      if (a.currency === "USD") adSpendUsd += native;
      return {
        id: a.id,
        kind: "expense",
        category: "ad_spend",
        title: `${channelShort(a.channel)} · ${a.campaign}`,
        amount: kzt,
        spent_on: a.spent_on,
        note: `${objectiveLabel(a.objective)}${a.currency === "USD" ? ` · ${formatUsd(native)}` : ""}`,
        locked: true,
      };
    });
  }

  const adSpendTotal = adAsLedger.reduce((s, r) => s + r.amount, 0);
  const manualExpense = manual.filter((r) => r.kind === "expense").reduce((s, r) => s + Number(r.amount), 0);
  const incomeTotal = manual.filter((r) => r.kind === "income").reduce((s, r) => s + Number(r.amount), 0);
  const expenseTotal = manualExpense + adSpendTotal;
  const salesRevenue = (salesRows ?? []).reduce((s, r) => s + Number(r.amount), 0);
  const profit = salesRevenue + incomeTotal - expenseTotal;

  const payrollFund = (payrolls ?? []).reduce(
    (s, p) =>
      s +
      payrollTotal({
        base_salary: Number(p.base_salary),
        days_planned: p.days_planned,
        days_worked: p.days_worked,
        kpi_bonus: Number(p.kpi_bonus),
        bonus: Number(p.bonus),
        deduction: Number(p.deduction),
      }),
    0,
  );

  // Структура расходов по категориям (с учётом рекламы)
  const byCategory = new Map<string, number>();
  for (const r of [...manual, ...adAsLedger]) {
    if (r.kind !== "expense") continue;
    byCategory.set(r.category, (byCategory.get(r.category) ?? 0) + Number(r.amount));
  }
  const categories = [...byCategory.entries()]
    .map(([key, sum]) => ({ key, sum, pct: expenseTotal > 0 ? (sum / expenseTotal) * 100 : 0 }))
    .sort((a, b) => b.sum - a.sum);

  // Единая ведомость: ручные операции + реклама, по дате
  const ledger = [...manual, ...adAsLedger].sort((a, b) => (a.spent_on < b.spent_on ? 1 : -1));

  const exportRows = ledger.map((r) => [
    r.spent_on,
    kindLabel(r.kind),
    categoryLabel(r.category),
    r.title,
    r.kind === "income" ? Math.round(r.amount) : -Math.round(r.amount),
    r.note ?? "",
  ]);

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <PageHeader title="Финансы" subtitle={`Доходы и расходы агентства · период: ${range.label}`}>
        <div className="flex items-center gap-2">
          <ExportButton
            filename={`finansy-${range.from}_${range.to}`}
            headers={["Дата", "Тип", "Категория", "Операция", "Сумма", "Комментарий"]}
            rows={exportRows}
          />
          <DateRangePicker preset={range.preset} from={range.from} to={range.to} label={range.label} />
        </div>
      </PageHeader>

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Выручка (продажи)" value={formatCurrency(salesRevenue)} icon={TrendingUp} tone="ink" />
        <StatCard label="Расходы" value={formatCurrency(expenseTotal)} icon={TrendingDown} tone="ink" />
        <StatCard
          label="Прибыль"
          value={formatCurrency(profit)}
          icon={Wallet}
          tone={profit >= 0 ? "brand" : "danger"}
        />
        <StatCard label={`Зарплаты · ${periodLabel(period)}`} value={formatCurrency(payrollFund)} icon={Users} tone="ink" />
      </div>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-card bg-canvas px-4 py-3 text-sm text-muted">
        <span>
          Реклама за период:{" "}
          <span className="font-semibold text-ink">{formatCurrency(adSpendTotal)}</span>
          {adSpendUsd > 0 && ` (${formatUsd(adSpendUsd)} по курсу ${usdRate} ₸)`} — авто из{" "}
          <a href={`/p/${projectId}/ads`} className="font-medium text-brand-ink hover:underline">
            «Реклама»
          </a>
          .
        </span>
        <UsdRateEditor projectId={projectId} rate={usdRate} />
      </div>

      <div className="mb-6">
        <FinanceForm projectId={projectId} today={localDay()} />
      </div>

      {categories.length > 0 && (
        <div className="mb-6 rounded-card bg-surface p-6 shadow-soft ring-1 ring-line">
          <h2 className="mb-4 text-base font-semibold text-ink">Структура расходов</h2>
          <div className="space-y-3">
            {categories.map((c) => (
              <div key={c.key}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="text-muted">{categoryLabel(c.key)}</span>
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

      <h2 className="mb-3 text-base font-semibold text-ink">Операции</h2>
      <FinanceLedger projectId={projectId} rows={ledger} />
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
  tone: "ink" | "brand" | "danger";
}) {
  const valueColor =
    tone === "brand" ? "text-brand-ink" : tone === "danger" ? "text-red-600" : "text-ink";
  return (
    <div className="rounded-card bg-surface p-5 shadow-soft ring-1 ring-line">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted">{label}</span>
        <Icon className="h-4 w-4 text-faint" />
      </div>
      <div className={`mt-2 text-2xl font-bold ${valueColor}`}>{value}</div>
    </div>
  );
}
