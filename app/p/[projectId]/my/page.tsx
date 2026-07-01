import Link from "next/link";
import {
  Users,
  CheckCircle2,
  Percent,
  ShoppingCart,
  Coins,
  Tag,
  GraduationCap,
  Megaphone,
  TrendingDown,
  Share2,
  CalendarClock,
  BarChart3,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireAccess, getEffectiveRole } from "@/lib/queries";
import { rangeFromSearchParams, rangeEndExclusive } from "@/lib/date-range";
import { formatCurrency, formatNumber, formatPercent, formatUsd } from "@/lib/format";
import { getDailyAdReport } from "@/lib/ads-daily";
import { roleLabel } from "@/lib/members";
import { PageHeader } from "@/components/page-header";
import { DateRangePicker } from "@/components/date-range-picker";
import { MetricCard } from "@/components/metric-card";

const pct = (n: number, d: number) => (d > 0 ? (n / d) * 100 : 0);

interface Card {
  label: string;
  value: string;
  icon: LucideIcon;
  accent?: boolean;
  hint?: string;
}

/**
 * «Мой отчёт» — личная статистика сотрудника за период. Каждый видит только
 * свои данные (фильтр по своему user.id); руководитель — сводку в «Отчётах».
 */
export default async function MyReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { projectId } = await params;
  await requireAccess(projectId, "my");
  const range = rangeFromSearchParams(await searchParams);
  const from = range.from;
  const endExcl = rangeEndExclusive(range);

  const supabase = await createClient();
  const [role, { data: auth }] = await Promise.all([
    getEffectiveRole(projectId),
    supabase.auth.getUser(),
  ]);
  const uid = auth.user?.id ?? "";
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", uid)
    .maybeSingle();

  const isBoss = role === "owner" || role === "director";
  const isSell = role === "manager" || role === "head_sales";

  let cards: Card[] = [];
  let note: string | null = null;
  let reportLink: { href: string; label: string } | null = null;

  if (isBoss) {
    note =
      "Вы руководитель — вам доступна полная статистика команды в разделе «Отчёты» (РНП, менеджеры, хантеры, источники, аудитория).";
    reportLink = { href: `/p/${projectId}/reports`, label: "Открыть Отчёты" };
  } else if (role === "hunter") {
    const { data } = await supabase
      .from("leads")
      .select("status")
      .eq("project_id", projectId)
      .eq("assigned_to", uid)
      .gte("created_at", from)
      .lt("created_at", endExcl);
    const arr = data ?? [];
    const qualified = arr.filter((l) =>
      ["assigned", "trial", "trial_done", "paid", "sale"].includes(l.status),
    ).length;
    cards = [
      { label: "Мои лиды", value: formatNumber(arr.length), icon: Users, accent: true },
      { label: "Квалифицировано", value: formatNumber(qualified), icon: CheckCircle2 },
      { label: "Конверсия", value: formatPercent(pct(qualified, arr.length)), icon: Percent },
    ];
  } else if (isSell) {
    const [{ data: sales }, { data: trials }] = await Promise.all([
      supabase
        .from("sales")
        .select("amount")
        .eq("project_id", projectId)
        .eq("manager_id", uid)
        .gte("created_at", from)
        .lt("created_at", endExcl),
      supabase
        .from("trials")
        .select("status")
        .eq("project_id", projectId)
        .eq("assigned_to", uid)
        .gte("scheduled_at", from)
        .lt("scheduled_at", endExcl),
    ]);
    const s = sales ?? [];
    const t = trials ?? [];
    const revenue = s.reduce((a, x) => a + Number(x.amount), 0);
    const conducted = t.filter((x) => ["attended", "purchased"].includes(x.status)).length;
    const purchased = t.filter((x) => x.status === "purchased").length;
    cards = [
      { label: "Мои продажи", value: formatNumber(s.length), icon: ShoppingCart, accent: true },
      { label: "Выручка", value: formatCurrency(revenue), icon: Coins, accent: true },
      { label: "Средний чек", value: s.length > 0 ? formatCurrency(revenue / s.length) : "—", icon: Tag },
      { label: "Проведено пробных", value: formatNumber(conducted), icon: GraduationCap },
      { label: "Купили после пробного", value: formatNumber(purchased), icon: CheckCircle2 },
      { label: "Конверсия пробный→продажа", value: formatPercent(pct(purchased, conducted)), icon: Percent },
    ];
  } else if (role === "teacher") {
    const { data } = await supabase
      .from("trials")
      .select("status")
      .eq("project_id", projectId)
      .eq("assigned_to", uid)
      .gte("scheduled_at", from)
      .lt("scheduled_at", endExcl);
    const t = data ?? [];
    const attended = t.filter((x) => ["attended", "purchased"].includes(x.status)).length;
    const purchased = t.filter((x) => x.status === "purchased").length;
    cards = [
      { label: "Пробных назначено", value: formatNumber(t.length), icon: GraduationCap, accent: true },
      { label: "Проведено", value: formatNumber(attended), icon: CheckCircle2 },
      { label: "Явка", value: formatPercent(pct(attended, t.length)), icon: Percent },
      { label: "Купили после", value: formatNumber(purchased), icon: ShoppingCart },
    ];
  } else if (role === "targetologist" || role === "marketer") {
    const daily = await getDailyAdReport(projectId, range.from, range.to);
    const tot = daily.totals;
    cards = [
      { label: "Расход рекламы", value: formatUsd(tot.spendUsd, 2), icon: TrendingDown, accent: true },
      { label: "Лиды (Meta)", value: formatNumber(tot.leads), icon: Users, accent: true },
      { label: "Цена лида (CPL)", value: tot.cpl != null ? formatUsd(tot.cpl, 2) : "—", icon: Tag },
      { label: "Показы", value: formatNumber(tot.impressions), icon: Megaphone },
      { label: "Клики", value: formatNumber(tot.clicks), icon: Share2 },
      { label: "CTR", value: tot.ctr != null ? `${tot.ctr.toFixed(2)}%` : "—", icon: Percent },
    ];
    reportLink = { href: `/p/${projectId}/reports`, label: "Полный РНП и аудитория" };
  } else if (role === "smm") {
    const { data } = await supabase.from("smm_posts").select("status").eq("project_id", projectId);
    const p = data ?? [];
    const cnt = (st: string) => p.filter((x) => x.status === st).length;
    cards = [
      { label: "Постов в плане", value: formatNumber(p.length), icon: Share2, accent: true },
      { label: "Запланировано", value: formatNumber(cnt("scheduled")), icon: CalendarClock },
      { label: "Опубликовано", value: formatNumber(cnt("published")), icon: CheckCircle2 },
    ];
    reportLink = { href: `/p/${projectId}/smm`, label: "Открыть SMM Studio" };
  } else {
    note = "Личный отчёт для вашей роли скоро появится. Пока смотрите «Зарплаты» — свой расчёт за период.";
    reportLink = { href: `/p/${projectId}/salaries`, label: "Моя зарплата" };
  }

  const subtitle = `${profile?.full_name ?? "Сотрудник"} · ${roleLabel(role ?? "")} · период: ${range.label}`;

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <PageHeader title="Мой отчёт" subtitle={subtitle}>
        <DateRangePicker preset={range.preset} from={range.from} to={range.to} label={range.label} />
      </PageHeader>

      {cards.length > 0 && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          {cards.map((c) => (
            <MetricCard key={c.label} label={c.label} value={c.value} icon={c.icon} accent={c.accent} hint={c.hint} />
          ))}
        </div>
      )}

      {note && (
        <div className="mt-4 rounded-card border border-dashed border-line bg-surface px-6 py-8 text-center text-sm text-muted">
          {note}
        </div>
      )}

      {reportLink && (
        <div className="mt-5">
          <Link
            href={reportLink.href}
            className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-brand-strong"
          >
            <BarChart3 className="h-4 w-4" />
            {reportLink.label}
          </Link>
        </div>
      )}
    </div>
  );
}
