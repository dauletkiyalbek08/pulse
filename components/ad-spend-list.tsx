"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2 } from "lucide-react";
import { Pill } from "@/components/pill";
import { channelShort, objectiveLabel } from "@/lib/ads";
import { formatCurrency, formatDate, formatNumber } from "@/lib/format";
import { deleteAdSpend } from "@/app/p/[projectId]/ads/actions";

export interface AdRow {
  id: string;
  channel: string;
  objective: string;
  campaign: string;
  amount: number;
  spent_on: string;
  leads: number;
  note: string | null;
}

export function AdSpendList({ projectId, rows }: { projectId: string; rows: AdRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  function remove(id: string) {
    if (!confirm("Удалить расход?")) return;
    setBusyId(id);
    startTransition(async () => {
      await deleteAdSpend(projectId, id);
      setBusyId(null);
      router.refresh();
    });
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-card border border-dashed border-line bg-surface px-6 py-12 text-center text-sm text-muted">
        За выбранный период расходов на рекламу нет.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-card bg-surface shadow-soft ring-1 ring-line">
      <table className="w-full min-w-[720px] text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-faint">
            <th className="px-5 py-3 font-medium">Дата</th>
            <th className="px-5 py-3 font-medium">Канал</th>
            <th className="px-5 py-3 font-medium">Цель</th>
            <th className="px-5 py-3 font-medium">Кампания</th>
            <th className="px-5 py-3 text-right font-medium">Лидов</th>
            <th className="px-5 py-3 text-right font-medium">Цена лида</th>
            <th className="px-5 py-3 text-right font-medium">Расход</th>
            <th className="px-5 py-3" />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const cpl = r.leads > 0 ? r.amount / r.leads : null;
            return (
              <tr key={r.id} className="border-b border-line last:border-0 transition hover:bg-canvas">
                <td className="whitespace-nowrap px-5 py-3 text-muted">{formatDate(r.spent_on)}</td>
                <td className="px-5 py-3 text-ink">{channelShort(r.channel)}</td>
                <td className="px-5 py-3">
                  <Pill tone={r.objective === "vacancy" ? "info" : "success"}>
                    {objectiveLabel(r.objective)}
                  </Pill>
                </td>
                <td className="px-5 py-3">
                  <div className="font-medium text-ink">{r.campaign}</div>
                  {r.note && <div className="text-xs text-faint">{r.note}</div>}
                </td>
                <td className="whitespace-nowrap px-5 py-3 text-right text-muted">
                  {r.leads > 0 ? formatNumber(r.leads) : "—"}
                </td>
                <td className="whitespace-nowrap px-5 py-3 text-right text-muted">
                  {cpl != null ? formatCurrency(cpl) : "—"}
                </td>
                <td className="whitespace-nowrap px-5 py-3 text-right font-semibold text-ink">
                  {formatCurrency(r.amount)}
                </td>
                <td className="px-5 py-3 text-right">
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
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
