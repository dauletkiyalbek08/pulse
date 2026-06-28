"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Phone, ArrowRight, X } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { Pill } from "@/components/pill";
import { getLeadStatusMeta, leadStatusOrder, sourceLabel, NEXT_STEP } from "@/lib/leads";
import type { Niche } from "@/lib/niches";
import { LeadPanel } from "@/components/lead-panel";
import type { BoardLead } from "@/components/funnel-board";
import { updateLeadStatus } from "@/app/p/[projectId]/funnel/actions";

/**
 * Рабочий список лидов хантера: позвонить, перевести на следующий этап,
 * отметить потерянным; клик по лиду — панель с полным статусом и заметками.
 */
export function HunterLeads({
  projectId,
  niche,
  leads: initial,
  showAssignee = false,
}: {
  projectId: string;
  niche: Niche;
  leads: BoardLead[];
  showAssignee?: boolean;
}) {
  const router = useRouter();
  const [leads, setLeads] = useState(initial);
  const [selected, setSelected] = useState<BoardLead | null>(null);
  const [, startTransition] = useTransition();

  // Поток без «Потерян» — для кнопки «следующий этап»
  const flow = leadStatusOrder(niche).filter((s) => s !== "lost");

  function setStatus(leadId: string, status: string) {
    setLeads((ls) => ls.map((l) => (l.id === leadId ? { ...l, status } : l)));
    setSelected((cur) => (cur && cur.id === leadId ? { ...cur, status } : cur));
    startTransition(async () => {
      await updateLeadStatus(projectId, leadId, status);
      router.refresh();
    });
  }

  if (leads.length === 0) {
    return (
      <div className="rounded-card border border-dashed border-line bg-surface px-6 py-12 text-center text-sm text-muted">
        Активных лидов нет. Новые появятся, как только бот раздаст заявку.
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2.5">
        {leads.map((lead) => {
          const meta = getLeadStatusMeta(niche, lead.status);
          const idx = flow.indexOf(lead.status);
          const next = idx >= 0 && idx < flow.length - 1 ? flow[idx + 1] : null;
          const nextMeta = next ? getLeadStatusMeta(niche, next) : null;
          const isClosed = lead.status === "paid" || lead.status === "lost";
          return (
            <div key={lead.id} className="rounded-card bg-surface p-4 shadow-soft ring-1 ring-line">
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => setSelected(lead)}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <Avatar name={lead.full_name} size="sm" />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-ink">{lead.full_name}</div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted">
                      <Pill tone={meta.tone}>{meta.label}</Pill>
                      <span>{sourceLabel(lead.source)}</span>
                      {showAssignee && lead.assigneeName && <span>· {lead.assigneeName}</span>}
                    </div>
                  </div>
                </button>

                <div className="flex items-center gap-2">
                  {lead.phone && (
                    <a
                      href={`tel:${lead.phone}`}
                      title="Позвонить"
                      className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-line bg-canvas px-3 text-sm text-ink transition hover:bg-surface"
                    >
                      <Phone className="h-4 w-4" />
                      <span className="hidden sm:inline">{lead.phone}</span>
                    </a>
                  )}
                  {next && nextMeta && (
                    <button
                      type="button"
                      onClick={() => setStatus(lead.id, next)}
                      className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-brand px-3 text-sm font-medium text-white transition hover:bg-brand-strong"
                    >
                      {nextMeta.label}
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  )}
                  {!isClosed && (
                    <button
                      type="button"
                      onClick={() => setStatus(lead.id, "lost")}
                      title="Отметить потерянным"
                      className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-line text-muted transition hover:bg-red-50 hover:text-red-600"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
              {NEXT_STEP[lead.status] && (
                <div className="mt-2 text-xs text-faint">Следующий шаг: {NEXT_STEP[lead.status]}</div>
              )}
            </div>
          );
        })}
      </div>

      {selected && (
        <LeadPanel
          projectId={projectId}
          niche={niche}
          lead={selected}
          onClose={() => setSelected(null)}
          onStatus={(status) => setStatus(selected.id, status)}
        />
      )}
    </>
  );
}
