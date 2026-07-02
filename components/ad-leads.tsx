"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Users, Trash2, Loader2 } from "lucide-react";
import { deleteAdLead, type AdLead } from "@/app/p/[projectId]/ads/launch-actions";

const LEAD_STATUS: Record<string, string> = {
  new: "Новый",
  assigned: "Назначен",
  accepted: "Принят",
  qualified: "Квалифицирован",
  processed: "Обработан",
  trial: "Пробный",
  sale: "Продажа",
};

/** Лиды с рекламы (квиз/сайт) за выбранный период — поимённо, с удалением тестовых. */
export function AdLeads({
  projectId,
  leads,
  rangeLabel,
}: {
  projectId: string;
  leads: AdLead[];
  rangeLabel: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  function remove(l: AdLead) {
    if (!confirm(`Удалить лид «${l.name}»? Это действие необратимо.`)) return;
    setBusyId(l.leadId);
    start(async () => {
      const r = await deleteAdLead(projectId, l.leadId);
      setBusyId(null);
      if (r.ok) router.refresh();
      else alert(r.error ?? "Ошибка");
    });
  }

  return (
    <div className="rounded-card bg-surface p-5 shadow-soft ring-1 ring-line">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-soft text-brand-ink">
          <Users className="h-5 w-5" />
        </span>
        <div>
          <div className="text-sm font-semibold text-ink">Лиды с рекламы (квиз) · {rangeLabel}</div>
          <div className="text-xs text-muted">Кто оставил заявку через квиз/сайт. Купившие — вверху. Тестовые можно удалить 🗑</div>
        </div>
      </div>

      {leads.length === 0 ? (
        <p className="rounded-lg bg-canvas px-3 py-4 text-center text-sm text-muted">
          За «{rangeLabel}» заявок с рекламы нет.
        </p>
      ) : (
        <div className="divide-y divide-line">
          {leads.map((l) => (
            <div key={l.leadId} className="flex items-center justify-between gap-2 py-2 text-sm">
              <div className="min-w-0">
                <span className="font-medium text-ink">{l.name}</span>
                {l.phone && <span className="ml-2 text-xs text-muted">{l.phone}</span>}
              </div>
              <div className="flex shrink-0 items-center gap-2 text-xs">
                {l.bought && (
                  <span className="rounded bg-brand-soft px-1.5 py-0.5 font-semibold text-brand-ink">💰 купил</span>
                )}
                <span className="text-muted">{LEAD_STATUS[l.status] ?? l.status}</span>
                <span className="text-faint">{new Date(l.createdAt).toLocaleDateString("ru-RU")}</span>
                <button
                  type="button"
                  onClick={() => remove(l)}
                  disabled={pending}
                  title="Удалить лид"
                  className="text-faint transition hover:text-red-600 disabled:opacity-50"
                >
                  {busyId === l.leadId ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
