import { Wallet, Users, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getEffectiveRole, requireAccess } from "@/lib/queries";
import { roleLabel } from "@/lib/members";
import { localDay } from "@/lib/attendance";
import {
  currentPeriod,
  isPeriod,
  periodBounds,
  periodLabel,
  scheduledDaysInMonth,
  accruedBase,
  payrollTotal,
  PAYROLL_STATUS,
} from "@/lib/finance";
import { formatCurrency } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { Pill } from "@/components/pill";
import { MonthPicker } from "@/components/month-picker";
import { PayrollRow } from "@/components/payroll-row";
import type { PayrollForm } from "@/app/p/[projectId]/salaries/actions";

const MANAGE_ROLES = ["owner", "director", "accountant"];
const DEFAULT_DAYS = [1, 2, 3, 4, 5];

interface PayrollDb {
  user_id: string;
  base_salary: number;
  days_planned: number;
  days_worked: number;
  kpi_bonus: number;
  bonus: number;
  deduction: number;
  status: string;
  note: string | null;
}

function toForm(p: PayrollDb): PayrollForm {
  return {
    base_salary: Number(p.base_salary),
    days_planned: p.days_planned,
    days_worked: p.days_worked,
    kpi_bonus: Number(p.kpi_bonus),
    bonus: Number(p.bonus),
    deduction: Number(p.deduction),
    status: p.status,
    note: p.note ?? "",
  };
}

export default async function SalariesPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { projectId } = await params;
  await requireAccess(projectId, "salaries");

  const sp = await searchParams;
  const monthParam = typeof sp.month === "string" ? sp.month : undefined;
  const period = isPeriod(monthParam) ? monthParam : currentPeriod();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const uid = user?.id ?? "";
  const role = await getEffectiveRole(projectId);
  const canManage = !!role && MANAGE_ROLES.includes(role);

  const bounds = periodBounds(period);

  /* ───────────── Личный кабинет сотрудника: только своя зарплата ───────────── */
  if (!canManage) {
    const { data: own } = await supabase
      .from("payroll")
      .select("user_id, base_salary, days_planned, days_worked, kpi_bonus, bonus, deduction, status, note")
      .eq("project_id", projectId)
      .eq("user_id", uid)
      .eq("period", period)
      .maybeSingle();

    return (
      <div className="mx-auto max-w-2xl px-6 py-8">
        <PageHeader title="Моя зарплата" subtitle="Расчёт за выбранный месяц">
          <MonthPicker period={period} />
        </PageHeader>

        {!own ? (
          <div className="rounded-card border border-dashed border-line bg-surface px-6 py-12 text-center text-sm text-muted">
            За {periodLabel(period)} зарплата ещё не рассчитана.
          </div>
        ) : (
          <PersonalCard form={toForm(own)} />
        )}
      </div>
    );
  }

  /* ─────────────────── Управление зарплатами команды ─────────────────── */
  const [{ data: members }, { data: payrolls }, { data: schedules }, { data: shifts }] =
    await Promise.all([
      supabase
        .from("project_members")
        .select("user_id, role")
        .eq("project_id", projectId)
        .eq("status", "active"),
      supabase
        .from("payroll")
        .select("user_id, base_salary, days_planned, days_worked, kpi_bonus, bonus, deduction, status, note")
        .eq("project_id", projectId)
        .eq("period", period),
      supabase
        .from("work_schedules")
        .select("user_id, days")
        .eq("project_id", projectId),
      supabase
        .from("shifts")
        .select("user_id, started_at")
        .eq("project_id", projectId)
        .gte("started_at", `${bounds.from}T00:00:00+05:00`)
        .lt("started_at", `${bounds.toExclusive}T00:00:00+05:00`),
    ]);

  const team = members ?? [];
  const ids = team.map((m) => m.user_id);
  const { data: profiles } = ids.length
    ? await supabase.from("profiles").select("id, full_name").in("id", ids)
    : { data: [] };
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
  const payrollByUser = new Map((payrolls ?? []).map((p) => [p.user_id, p as PayrollDb]));
  const daysByUser = new Map((schedules ?? []).map((s) => [s.user_id, s.days]));

  // Фактически отработанные дни = число различных дней со сменой в месяце
  const workedByUser = new Map<string, Set<string>>();
  for (const s of shifts ?? []) {
    const set = workedByUser.get(s.user_id) ?? new Set<string>();
    set.add(localDay(s.started_at));
    workedByUser.set(s.user_id, set);
  }

  const rows = team
    .map((m) => {
      const existing = payrollByUser.get(m.user_id);
      const planned = scheduledDaysInMonth(period, daysByUser.get(m.user_id) ?? DEFAULT_DAYS);
      const actualWorked = workedByUser.get(m.user_id)?.size ?? 0;
      const form: PayrollForm = existing
        ? toForm(existing)
        : {
            base_salary: 0,
            days_planned: planned,
            days_worked: actualWorked,
            kpi_bonus: 0,
            bonus: 0,
            deduction: 0,
            status: "draft",
            note: "",
          };
      return {
        userId: m.user_id,
        name: nameById.get(m.user_id) ?? "—",
        role: m.role,
        form,
        actualWorked,
        total: payrollTotal(form),
        status: form.status,
      };
    })
    .sort((a, b) => b.total - a.total);

  const fund = rows.reduce((s, r) => s + r.total, 0);
  const paid = rows.filter((r) => r.status === "paid").reduce((s, r) => s + r.total, 0);

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <PageHeader
        title="Зарплаты"
        subtitle="Оклад, KPI и отработанные дни по каждому сотруднику"
      >
        <MonthPicker period={period} />
      </PageHeader>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label={`Фонд за ${periodLabel(period)}`} value={formatCurrency(fund)} icon={Wallet} tone="brand" />
        <StatCard label="Сотрудников" value={String(rows.length)} icon={Users} tone="ink" />
        <StatCard label="Уже выплачено" value={formatCurrency(paid)} icon={CheckCircle2} tone="ink" />
      </div>

      {rows.length === 0 ? (
        <div className="rounded-card border border-dashed border-line bg-surface px-6 py-12 text-center text-sm text-muted">
          В проекте пока нет сотрудников.
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <PayrollRow
              key={r.userId}
              projectId={projectId}
              userId={r.userId}
              name={r.name}
              role={r.role}
              period={period}
              initial={r.form}
              hintWorked={r.actualWorked}
            />
          ))}
        </div>
      )}

      <p className="mt-6 text-xs text-muted">
        «Оклад по дням» считается как оклад × отработано ÷ план. Итог к выплате = оклад по
        дням + KPI + бонус − удержания. Каждый сотрудник видит свою зарплату в этом разделе.
      </p>
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

function PersonalCard({ form }: { form: PayrollForm }) {
  const base = accruedBase(form.base_salary, form.days_planned, form.days_worked);
  const total = payrollTotal(form);
  const meta = PAYROLL_STATUS[form.status] ?? PAYROLL_STATUS.draft;

  const lines: { label: string; value: string; strong?: boolean }[] = [
    { label: `Оклад по дням (${form.days_worked} из ${form.days_planned})`, value: formatCurrency(base) },
    { label: "KPI / премия", value: formatCurrency(form.kpi_bonus) },
    { label: "Бонус", value: formatCurrency(form.bonus) },
    { label: "Удержания", value: `− ${formatCurrency(form.deduction)}` },
  ];

  return (
    <div className="rounded-card bg-surface p-6 shadow-soft ring-1 ring-line">
      <div className="mb-4 flex items-center justify-between">
        <span className="text-sm text-muted">Статус</span>
        <Pill tone={meta.tone}>{meta.label}</Pill>
      </div>
      <dl className="space-y-2.5 text-sm">
        {lines.map((l) => (
          <div key={l.label} className="flex justify-between gap-4">
            <dt className="text-muted">{l.label}</dt>
            <dd className="font-medium text-ink">{l.value}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-4 flex items-center justify-between border-t border-line pt-4">
        <span className="font-semibold text-ink">К выплате</span>
        <span className="text-2xl font-bold text-brand-ink">{formatCurrency(total)}</span>
      </div>
      {form.note && <p className="mt-3 rounded-lg bg-canvas px-3 py-2 text-sm text-muted">{form.note}</p>}
    </div>
  );
}
