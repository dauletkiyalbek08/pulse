"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { periodLabel, shiftPeriod } from "@/lib/finance";

/** Переключатель месяца (‹ Июнь 2026 ›), состояние живёт в URL ?month=YYYY-MM. */
export function MonthPicker({ period }: { period: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function go(delta: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("month", shiftPeriod(period, delta));
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="inline-flex items-center gap-1 rounded-xl border border-line bg-surface p-1 shadow-soft">
      <button
        type="button"
        onClick={() => go(-1)}
        aria-label="Предыдущий месяц"
        className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition hover:bg-canvas hover:text-ink"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <span className="min-w-[120px] text-center text-sm font-semibold text-ink">
        {periodLabel(period)}
      </span>
      <button
        type="button"
        onClick={() => go(1)}
        aria-label="Следующий месяц"
        className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition hover:bg-canvas hover:text-ink"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
