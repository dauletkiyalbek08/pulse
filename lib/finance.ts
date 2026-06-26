/**
 * Финансы и зарплата: категории расходов, расчёт зарплаты по дням/KPI,
 * помощники по месячным периодам. Все суммы — в тенге (см. lib/format).
 */
import { ATTENDANCE_TZ } from "@/lib/attendance";

/* ─────────────────────────── Финансовая ведомость ─────────────────────────── */

export type FinanceKind = "expense" | "income";

export interface FinanceCategory {
  key: string;
  label: string;
}

/** Категории операций (расходы агентства + поступления). */
export const FINANCE_CATEGORIES: FinanceCategory[] = [
  { key: "ad_spend", label: "Реклама" },
  { key: "production", label: "Съёмки / продакшн" },
  { key: "talent", label: "Лицо бренда / блогер" },
  { key: "marketing", label: "Маркетинг" },
  { key: "salary", label: "Зарплаты" },
  { key: "bonus", label: "Бонусы" },
  { key: "rent", label: "Аренда / офис" },
  { key: "tools", label: "Сервисы и подписки" },
  { key: "other", label: "Прочее" },
];

const CATEGORY_LABEL = new Map(FINANCE_CATEGORIES.map((c) => [c.key, c.label]));

export function categoryLabel(key: string): string {
  return CATEGORY_LABEL.get(key) ?? "Прочее";
}

export function kindLabel(kind: string): string {
  return kind === "income" ? "Поступление" : "Расход";
}

/* ──────────────────────────────── Зарплата ───────────────────────────────── */

export interface PayrollInput {
  base_salary: number;
  days_planned: number;
  days_worked: number;
  kpi_bonus: number;
  bonus: number;
  deduction: number;
}

/** Начислено по окладу с учётом отработанных дней. */
export function accruedBase(base: number, daysPlanned: number, daysWorked: number): number {
  if (daysPlanned <= 0) return Math.round(base);
  return Math.round((base * daysWorked) / daysPlanned);
}

/** Итог к выплате: оклад (по дням) + KPI + бонусы − удержания. */
export function payrollTotal(p: PayrollInput): number {
  return (
    accruedBase(p.base_salary, p.days_planned, p.days_worked) +
    Number(p.kpi_bonus) +
    Number(p.bonus) -
    Number(p.deduction)
  );
}

export const PAYROLL_STATUS: Record<string, { label: string; tone: "neutral" | "info" | "success" }> = {
  draft: { label: "Черновик", tone: "neutral" },
  approved: { label: "Утверждена", tone: "info" },
  paid: { label: "Выплачена", tone: "success" },
};

/* ───────────────────────── Месячные периоды (YYYY-MM) ─────────────────────── */

const RU_MONTHS = [
  "январь", "февраль", "март", "апрель", "май", "июнь",
  "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь",
];

/** Текущий месяц проекта в TZ проекта → "YYYY-MM". */
export function currentPeriod(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: ATTENDANCE_TZ,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === "year")?.value ?? "1970";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  return `${y}-${m}`;
}

/** "2026-06" → "Июнь 2026". */
export function periodLabel(period: string): string {
  const [y, m] = period.split("-").map(Number);
  const name = RU_MONTHS[(m ?? 1) - 1] ?? "";
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${y}`;
}

/** Сдвиг месяца на delta (±1) → "YYYY-MM". */
export function shiftPeriod(period: string, delta: number): string {
  const [y, m] = period.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Границы месяца как ISO-даты для фильтра timestamptz: [from, toExclusive). */
export function periodBounds(period: string): { from: string; toExclusive: string } {
  const [y, m] = period.split("-").map(Number);
  const from = new Date(Date.UTC(y, m - 1, 1));
  const toExclusive = new Date(Date.UTC(y, m, 1));
  return {
    from: from.toISOString().slice(0, 10),
    toExclusive: toExclusive.toISOString().slice(0, 10),
  };
}

/** "YYYY-MM" корректного формата? */
export function isPeriod(v: string | undefined): v is string {
  return !!v && /^\d{4}-(0[1-9]|1[0-2])$/.test(v);
}

/** Сколько рабочих дней по графику (ISO-дни недели) выпадает на месяц. */
export function scheduledDaysInMonth(period: string, isoDays: number[]): number {
  const [y, m] = period.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const set = new Set(isoDays.length ? isoDays : [1, 2, 3, 4, 5]);
  let count = 0;
  for (let day = 1; day <= daysInMonth; day++) {
    const wd = new Date(Date.UTC(y, m - 1, day)).getUTCDay(); // 0=Вс
    const iso = wd === 0 ? 7 : wd;
    if (set.has(iso)) count++;
  }
  return count;
}
