"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2 } from "lucide-react";
import { Pill } from "@/components/pill";
import { categoryLabel } from "@/lib/finance";
import { formatCurrency, formatDate } from "@/lib/format";
import { deleteFinanceEntry } from "@/app/p/[projectId]/finance/actions";

export interface LedgerRow {
  id: string;
  kind: string;
  category: string;
  title: string;
  amount: number;
  spent_on: string;
  note: string | null;
  /** Строка собрана из другого раздела (напр. «Реклама») — нельзя удалять здесь. */
  locked?: boolean;
}

export function FinanceLedger({
  projectId,
  rows,
}: {
  projectId: string;
  rows: LedgerRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  function remove(id: string) {
    if (!confirm("Удалить операцию?")) return;
    setBusyId(id);
    startTransition(async () => {
      await deleteFinanceEntry(projectId, id);
      setBusyId(null);
      router.refresh();
    });
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-card border border-dashed border-line bg-surface px-6 py-12 text-center text-sm text-muted">
        За выбранный период операций нет.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-card bg-surface shadow-soft ring-1 ring-line">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-faint">
            <th className="px-5 py-3 font-medium">Дата</th>
            <th className="px-5 py-3 font-medium">Категория</th>
            <th className="px-5 py-3 font-medium">Операция</th>
            <th className="px-5 py-3 text-right font-medium">Сумма</th>
            <th className="px-5 py-3" />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const income = r.kind === "income";
            return (
              <tr key={r.id} className="border-b border-line last:border-0 transition hover:bg-canvas">
                <td className="whitespace-nowrap px-5 py-3 text-muted">{formatDate(r.spent_on)}</td>
                <td className="px-5 py-3">
                  <Pill tone={income ? "success" : "neutral"}>{categoryLabel(r.category)}</Pill>
                </td>
                <td className="px-5 py-3">
                  <div className="font-medium text-ink">{r.title}</div>
                  {r.note && <div className="text-xs text-faint">{r.note}</div>}
                </td>
                <td
                  className={`whitespace-nowrap px-5 py-3 text-right font-semibold ${
                    income ? "text-brand-ink" : "text-ink"
                  }`}
                >
                  {income ? "+" : "−"} {formatCurrency(r.amount)}
                </td>
                <td className="px-5 py-3 text-right">
                  {r.locked ? (
                    <span className="text-xs text-faint">из «Рекламы»</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => remove(r.id)}
                      disabled={pending && busyId === r.id}
                      aria-label="Удалить"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-faint transition hover:bg-red-50 hover:text-red-600"
                    >
                      {pending && busyId === r.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
