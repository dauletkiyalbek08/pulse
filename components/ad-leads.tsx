import { Users } from "lucide-react";
import type { AdLead } from "@/app/p/[projectId]/ads/launch-actions";

const LEAD_STATUS: Record<string, string> = {
  new: "Новый",
  assigned: "Назначен",
  accepted: "Принят",
  qualified: "Квалифицирован",
  processed: "Обработан",
  trial: "Пробный",
  sale: "Продажа",
};

/** Лиды с рекламы (квиз/сайт) за выбранный период — поимённо, кто пришёл. */
export function AdLeads({ leads, rangeLabel }: { leads: AdLead[]; rangeLabel: string }) {
  return (
    <div className="rounded-card bg-surface p-5 shadow-soft ring-1 ring-line">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-soft text-brand-ink">
          <Users className="h-5 w-5" />
        </span>
        <div>
          <div className="text-sm font-semibold text-ink">Лиды с рекламы (квиз) · {rangeLabel}</div>
          <div className="text-xs text-muted">Кто оставил заявку через квиз/сайт. Купившие — вверху. Удаление — в разделе «Лиды».</div>
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
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
