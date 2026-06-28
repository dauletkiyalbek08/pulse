"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import type { Employee } from "@/components/call-analyze-form";

const PERIODS: { key: string; label: string }[] = [
  { key: "7", label: "7 дней" },
  { key: "30", label: "30 дней" },
  { key: "all", label: "Всё время" },
];

/** Фильтры разборов звонков: период + сотрудник (через URL). */
export function CallsFilters({
  employees,
  emp,
  period,
}: {
  employees: Employee[];
  emp: string;
  period: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setParam(key: string, val: string) {
    const p = new URLSearchParams(searchParams.toString());
    if (val) p.set(key, val);
    else p.delete(key);
    router.push(`${pathname}?${p.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="inline-flex rounded-xl border border-line bg-canvas p-0.5">
        {PERIODS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => setParam("period", p.key)}
            className={`rounded-lg px-3 py-1.5 text-sm transition ${
              period === p.key ? "bg-surface font-medium text-ink shadow-soft" : "text-muted hover:text-ink"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <select
        value={emp}
        onChange={(e) => setParam("emp", e.target.value)}
        className="rounded-xl border border-line bg-canvas px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none"
      >
        <option value="">Все сотрудники</option>
        {employees.map((e) => (
          <option key={e.id} value={e.id}>
            {e.name} — {e.role === "hunter" ? "хантер" : "менеджер"}
          </option>
        ))}
      </select>
    </div>
  );
}
