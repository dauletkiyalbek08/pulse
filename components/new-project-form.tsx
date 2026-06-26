"use client";

import { useActionState, useState } from "react";
import { Loader2, Check } from "lucide-react";
import {
  createProject,
  type NewProjectState,
} from "@/app/projects/new/actions";
import { NICHE_LIST } from "@/lib/niches";
import { getProjectIcon } from "@/components/icons";

const initialState: NewProjectState = { error: null };

export function NewProjectForm() {
  const [niche, setNiche] = useState<string>("");
  const [state, formAction, pending] = useActionState(
    createProject,
    initialState,
  );

  return (
    <form action={formAction} className="space-y-7">
      {/* Выбор ниши */}
      <fieldset>
        <legend className="text-sm font-medium text-ink">Ниша проекта</legend>
        <input type="hidden" name="niche" value={niche} />
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {NICHE_LIST.map((n) => {
            const Icon = getProjectIcon(n.icon);
            const selected = niche === n.key;
            return (
              <button
                key={n.key}
                type="button"
                onClick={() => setNiche(n.key)}
                className={`relative flex flex-col rounded-card border p-5 text-left transition ${
                  selected
                    ? "border-brand bg-brand-soft/50 ring-1 ring-brand"
                    : "border-line bg-surface hover:border-brand/40"
                }`}
              >
                {selected && (
                  <span className="absolute right-4 top-4 flex h-5 w-5 items-center justify-center rounded-full bg-brand text-white">
                    <Check className="h-3 w-3" strokeWidth={3} />
                  </span>
                )}
                <span
                  className="flex h-11 w-11 items-center justify-center rounded-tile"
                  style={{ backgroundColor: `${n.accent}1a`, color: n.accent }}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <span className="mt-4 text-base font-semibold text-ink">
                  {n.label}
                </span>
                <span className="mt-1 text-sm text-muted">{n.tagline}</span>
                <span className="mt-3 text-xs text-faint">
                  {n.funnel.join(" → ")}
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      {/* Название */}
      <div>
        <label className="text-sm font-medium text-ink" htmlFor="name">
          Название проекта
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          placeholder="Например, Английский курс"
          className="mt-1.5 w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-faint focus:border-brand focus:outline-none"
        />
      </div>

      {/* Директор */}
      <div>
        <label className="text-sm font-medium text-ink" htmlFor="director_name">
          Директор проекта{" "}
          <span className="font-normal text-faint">(необязательно)</span>
        </label>
        <input
          id="director_name"
          name="director_name"
          type="text"
          placeholder="ФИО директора"
          className="mt-1.5 w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-faint focus:border-brand focus:outline-none"
        />
      </div>

      {/* Описание */}
      <div>
        <label className="text-sm font-medium text-ink" htmlFor="description">
          Описание{" "}
          <span className="font-normal text-faint">(необязательно)</span>
        </label>
        <textarea
          id="description"
          name="description"
          rows={3}
          placeholder="Коротко о проекте: что продвигаем и для кого."
          className="mt-1.5 w-full resize-none rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-faint focus:border-brand focus:outline-none"
        />
      </div>

      {state.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {state.error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-brand-strong disabled:opacity-60"
        >
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          {pending ? "Создаём..." : "Создать проект"}
        </button>
      </div>
    </form>
  );
}
