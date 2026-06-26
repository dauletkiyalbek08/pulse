"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Check } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { roleLabel } from "@/lib/members";
import { accruedBase, payrollTotal } from "@/lib/finance";
import { formatCurrency } from "@/lib/format";
import { savePayroll, type PayrollForm } from "@/app/p/[projectId]/salaries/actions";

const STATUS_OPTIONS = [
  { value: "draft", label: "Черновик" },
  { value: "approved", label: "Утверждена" },
  { value: "paid", label: "Выплачена" },
];

function NumField({
  label,
  value,
  onChange,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  suffix?: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-muted">{label}</span>
      <div className="flex items-center rounded-lg border border-line bg-canvas focus-within:border-brand">
        <input
          type="number"
          min={0}
          value={Number.isFinite(value) ? value : 0}
          onChange={(e) => onChange(Number(e.target.value || 0))}
          className="w-full bg-transparent px-2.5 py-2 text-sm text-ink outline-none"
        />
        {suffix && <span className="pr-2.5 text-xs text-faint">{suffix}</span>}
      </div>
    </label>
  );
}

export function PayrollRow({
  projectId,
  userId,
  name,
  role,
  period,
  initial,
  hintWorked,
}: {
  projectId: string;
  userId: string;
  name: string;
  role: string;
  period: string;
  initial: PayrollForm;
  hintWorked: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState<PayrollForm>(initial);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof PayrollForm>(key: K, val: PayrollForm[K]) {
    setSaved(false);
    setForm((f) => ({ ...f, [key]: val }));
  }

  const base = accruedBase(form.base_salary, form.days_planned, form.days_worked);
  const total = payrollTotal(form);

  function save() {
    setError(null);
    startTransition(async () => {
      const res = await savePayroll(projectId, userId, period, form);
      if (!res.ok) setError(res.error ?? "Ошибка");
      else {
        setSaved(true);
        router.refresh();
        setTimeout(() => setSaved(false), 2000);
      }
    });
  }

  return (
    <div className="rounded-card bg-surface p-4 shadow-soft ring-1 ring-line">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={name} />
          <div className="min-w-0">
            <div className="truncate font-medium text-ink">{name}</div>
            <div className="text-xs text-muted">{roleLabel(role)}</div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-muted">К выплате</div>
          <div className="text-lg font-bold text-brand-ink">{formatCurrency(total)}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <NumField label="Оклад (месяц)" value={form.base_salary} onChange={(n) => set("base_salary", n)} suffix="₸" />
        <NumField label="План дней" value={form.days_planned} onChange={(n) => set("days_planned", n)} />
        <NumField label="Отработано" value={form.days_worked} onChange={(n) => set("days_worked", n)} />
        <NumField label="KPI / премия" value={form.kpi_bonus} onChange={(n) => set("kpi_bonus", n)} suffix="₸" />
        <NumField label="Бонус" value={form.bonus} onChange={(n) => set("bonus", n)} suffix="₸" />
        <NumField label="Удержание" value={form.deduction} onChange={(n) => set("deduction", n)} suffix="₸" />
      </div>

      <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="flex items-center gap-2 text-xs text-muted">
          <span>
            Оклад по дням: <span className="font-medium text-ink">{formatCurrency(base)}</span>
          </span>
          {hintWorked !== form.days_worked && (
            <button
              type="button"
              onClick={() => set("days_worked", hintWorked)}
              className="rounded-md bg-brand-soft px-2 py-0.5 font-medium text-brand-ink transition hover:bg-brand-soft/70"
            >
              по сменам: {hintWorked}
            </button>
          )}
        </div>
        <input
          value={form.note}
          onChange={(e) => set("note", e.target.value)}
          placeholder="Комментарий (необязательно)"
          className="min-w-0 flex-1 rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink placeholder:text-faint focus:border-brand focus:outline-none"
        />
        <select
          value={form.status}
          onChange={(e) => set("status", e.target.value)}
          className="rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-strong disabled:opacity-60"
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <Check className="h-4 w-4" /> : null}
          {saved ? "Сохранено" : "Сохранить"}
        </button>
      </div>

      {error && (
        <p className="mt-2 rounded-lg bg-red-50 px-3 py-1.5 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}
