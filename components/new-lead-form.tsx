"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Loader2, Plus, X, Check } from "lucide-react";
import { createLead, type NewLeadState } from "@/app/p/[projectId]/leads/actions";
import { LEAD_SOURCES } from "@/lib/leads";

const initial: NewLeadState = { error: null, ok: false };

const inputClass =
  "w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-faint focus:border-brand focus:outline-none";

export function NewLeadForm({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const action = createLead.bind(null, projectId);
  const [state, formAction, pending] = useActionState(action, initial);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state.ok]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-brand-strong"
      >
        <Plus className="h-4 w-4" />
        Добавить лид
      </button>
    );
  }

  return (
    <div className="rounded-card bg-surface p-5 shadow-soft ring-1 ring-line">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold text-ink">Новый лид</h2>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-muted transition hover:bg-canvas hover:text-ink"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <form
        ref={formRef}
        action={formAction}
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:items-end"
      >
        <div className="lg:col-span-1">
          <label className="text-xs font-medium text-muted">Имя *</label>
          <input name="full_name" required placeholder="ФИО" className={`mt-1 ${inputClass}`} />
        </div>
        <div>
          <label className="text-xs font-medium text-muted">Телефон</label>
          <input name="phone" placeholder="+7 ..." className={`mt-1 ${inputClass}`} />
        </div>
        <div>
          <label className="text-xs font-medium text-muted">Источник</label>
          <select name="source" defaultValue="instagram" className={`mt-1 ${inputClass}`}>
            {LEAD_SOURCES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="text-xs font-medium text-muted">Сумма, ₸</label>
            <input name="value" inputMode="numeric" placeholder="0" className={`mt-1 ${inputClass}`} />
          </div>
          <button
            type="submit"
            disabled={pending}
            className="inline-flex h-[42px] items-center gap-1.5 self-end rounded-xl bg-brand px-4 text-sm font-semibold text-white transition hover:bg-brand-strong disabled:opacity-60"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Добавить
          </button>
        </div>
      </form>

      {state.ok && (
        <p className="mt-3 inline-flex items-center gap-1.5 text-sm text-brand-ink">
          <Check className="h-4 w-4" /> Лид добавлен
        </p>
      )}
      {state.error && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{state.error}</p>
      )}
    </div>
  );
}
