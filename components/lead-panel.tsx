"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { X, Loader2, Send } from "lucide-react";
import { getLeadStatusMeta, leadStatusOrder, sourceLabel } from "@/lib/leads";
import type { Niche } from "@/lib/niches";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { Avatar } from "@/components/avatar";
import {
  getLeadNotes,
  addLeadNote,
  type LeadNote,
} from "@/app/p/[projectId]/funnel/actions";
import type { BoardLead } from "@/components/funnel-board";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted">{label}</span>
      <span className="text-right font-medium text-ink">{value}</span>
    </div>
  );
}

export function LeadPanel({
  projectId,
  niche,
  lead,
  onClose,
  onStatus,
}: {
  projectId: string;
  niche: Niche;
  lead: BoardLead;
  onClose: () => void;
  onStatus: (status: string) => void;
}) {
  const [notes, setNotes] = useState<LeadNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let active = true;
    getLeadNotes(lead.id).then((n) => {
      if (active) {
        setNotes(n);
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [lead.id]);

  function add() {
    const t = text.trim();
    if (!t) return;
    startTransition(async () => {
      await addLeadNote(projectId, lead.id, t);
      setText("");
      setNotes(await getLeadNotes(lead.id));
    });
  }

  const statuses = leadStatusOrder(niche);

  return createPortal(
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <aside className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-surface shadow-card">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div className="flex items-center gap-3">
            <Avatar name={lead.full_name} />
            <div>
              <div className="font-semibold text-ink">{lead.full_name}</div>
              <div className="text-xs text-muted">{sourceLabel(lead.source)}</div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition hover:bg-canvas hover:text-ink"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto p-5">
          <div className="space-y-2 text-sm">
            <Row
              label="Телефон"
              value={
                lead.phone ? (
                  <a href={`tel:${lead.phone}`} className="text-brand-ink hover:underline">
                    {lead.phone}
                  </a>
                ) : (
                  "—"
                )
              }
            />
            <Row label="Ответственный" value={lead.assigneeName ?? "—"} />
            <Row
              label="Сумма"
              value={Number(lead.value ?? 0) > 0 ? formatCurrency(Number(lead.value)) : "—"}
            />
          </div>

          {lead.note && (
            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-faint">
                Анкета · ответы квиза
              </div>
              <div className="whitespace-pre-wrap rounded-lg bg-canvas p-3 text-sm text-ink ring-1 ring-line">
                {lead.note}
              </div>
            </div>
          )}

          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-faint">
              Статус
            </div>
            <div className="flex flex-wrap gap-2">
              {statuses.map((s) => {
                const meta = getLeadStatusMeta(niche, s);
                const active = lead.status === s;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => onStatus(s)}
                    className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                      active
                        ? "bg-brand text-white"
                        : "border border-line bg-canvas text-ink hover:bg-surface"
                    }`}
                  >
                    {meta.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-faint">
              Заметки
            </div>
            <div className="flex gap-2">
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && add()}
                placeholder="Добавить заметку…"
                className="flex-1 rounded-xl border border-line bg-canvas px-3.5 py-2.5 text-sm text-ink placeholder:text-faint focus:border-brand focus:outline-none"
              />
              <button
                type="button"
                onClick={add}
                disabled={pending}
                className="inline-flex h-[42px] w-[42px] items-center justify-center rounded-xl bg-brand text-white transition hover:bg-brand-strong disabled:opacity-60"
              >
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </div>

            <ul className="mt-3 space-y-2">
              {loading ? (
                <li className="text-sm text-muted">Загрузка…</li>
              ) : notes.length === 0 ? (
                <li className="text-sm text-faint">Пока нет заметок.</li>
              ) : (
                notes.map((n) => (
                  <li key={n.id} className="rounded-lg bg-canvas p-3 text-sm">
                    <div className="whitespace-pre-wrap text-ink">{n.text}</div>
                    <div className="mt-1 text-xs text-faint">
                      {n.author} · {formatDateTime(n.created_at)}
                    </div>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      </aside>
    </div>,
    document.body,
  );
}
