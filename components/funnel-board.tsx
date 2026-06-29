"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/avatar";
import { getLeadStatusMeta, leadStatusOrder, sourceLabel } from "@/lib/leads";
import type { Niche } from "@/lib/niches";
import { formatCurrency } from "@/lib/format";
import { LeadPanel } from "@/components/lead-panel";
import { updateLeadStatus } from "@/app/p/[projectId]/funnel/actions";

export interface BoardLead {
  id: string;
  full_name: string;
  phone: string | null;
  source: string | null;
  status: string;
  value: number | null;
  assigneeName: string | null;
  note: string | null;
}

const DOT: Record<string, string> = {
  neutral: "bg-slate-400",
  info: "bg-blue-500",
  warning: "bg-amber-500",
  violet: "bg-violet-500",
  success: "bg-brand",
  danger: "bg-red-500",
};

export function FunnelBoard({
  projectId,
  niche,
  leads: initial,
}: {
  projectId: string;
  niche: Niche;
  leads: BoardLead[];
}) {
  const router = useRouter();
  const [leads, setLeads] = useState(initial);
  const [selected, setSelected] = useState<BoardLead | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const statuses = leadStatusOrder(niche);
  const gridCols =
    statuses.length >= 6
      ? "lg:grid-cols-6"
      : statuses.length >= 4
        ? "lg:grid-cols-4"
        : "lg:grid-cols-3";

  function move(leadId: string, status: string) {
    setLeads((ls) => ls.map((l) => (l.id === leadId ? { ...l, status } : l)));
    startTransition(async () => {
      await updateLeadStatus(projectId, leadId, status);
      router.refresh();
    });
  }

  return (
    <>
      <div className={`grid grid-cols-2 gap-3 sm:grid-cols-3 ${gridCols}`}>
        {statuses.map((status) => {
          const meta = getLeadStatusMeta(niche, status);
          const items = leads.filter((l) => l.status === status);
          const sum = items.reduce((s, l) => s + Number(l.value ?? 0), 0);
          return (
            <div
              key={status}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (dragId) move(dragId, status);
                setDragId(null);
              }}
              className="flex min-h-[140px] flex-col rounded-card bg-canvas p-2.5"
            >
              <div className="mb-1 flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${DOT[meta.tone]}`} />
                  <span className="text-sm font-medium text-ink">{meta.label}</span>
                </div>
                <span className="rounded-full bg-surface px-2 py-0.5 text-xs font-semibold text-muted ring-1 ring-line">
                  {items.length}
                </span>
              </div>
              <div className="mb-2 px-1 text-xs text-faint">{formatCurrency(sum)}</div>

              <div className="space-y-2">
                {items.map((lead) => (
                  <div
                    key={lead.id}
                    draggable
                    onDragStart={() => setDragId(lead.id)}
                    onDragEnd={() => setDragId(null)}
                    onClick={() => setSelected(lead)}
                    className="cursor-grab rounded-xl bg-surface p-3 shadow-soft ring-1 ring-line transition hover:ring-brand/40 active:cursor-grabbing"
                  >
                    <div className="flex items-center gap-2.5">
                      <Avatar name={lead.full_name} size="sm" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-ink">
                          {lead.full_name}
                        </div>
                        <div className="text-xs font-semibold text-ink">
                          {Number(lead.value ?? 0) > 0
                            ? formatCurrency(Number(lead.value))
                            : "0 ₸"}
                        </div>
                      </div>
                    </div>
                    <div className="mt-1.5 flex items-center gap-1.5 text-xs text-faint">
                      <span className={`h-1.5 w-1.5 rounded-full ${DOT[meta.tone]}`} />
                      {sourceLabel(lead.source)}
                    </div>
                  </div>
                ))}
                {items.length === 0 && (
                  <div className="rounded-xl border border-dashed border-line px-1 py-6 text-center text-xs text-faint">
                    Пусто
                  </div>
                )}
              </div>
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
          onStatus={(status) => {
            move(selected.id, status);
            setSelected({ ...selected, status });
          }}
        />
      )}
    </>
  );
}
