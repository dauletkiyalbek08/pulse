"use client";

import { useActionState, useState } from "react";
import { Loader2, UserPlus, KeyRound, Copy, Check } from "lucide-react";
import {
  createEmployee,
  type CreateEmployeeState,
} from "@/app/p/[projectId]/settings/actions";
import { roleLabel } from "@/lib/members";

const initialState: CreateEmployeeState = { error: null, created: null };

export function NewEmployeeForm({
  projectId,
  roles,
}: {
  projectId: string;
  roles: string[];
}) {
  const action = createEmployee.bind(null, projectId);
  const [state, formAction, pending] = useActionState(action, initialState);
  const [copied, setCopied] = useState(false);

  async function copyCreds() {
    if (!state.created) return;
    await navigator.clipboard.writeText(
      `Логин: ${state.created.email}\nПароль: ${state.created.password}`,
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-4">
      {state.created && (
        <div className="rounded-card border border-brand/30 bg-brand-soft/50 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-ink">
            <KeyRound className="h-4 w-4 text-brand-ink" />
            Сотрудник «{state.created.fullName}» создан ({roleLabel(state.created.role)})
          </div>
          <p className="mt-1 text-xs text-muted">
            Передайте доступы сотруднику. Пароль показывается один раз.
          </p>
          <dl className="mt-3 space-y-1.5 rounded-lg bg-surface p-3 text-sm ring-1 ring-line">
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Логин</dt>
              <dd className="font-mono text-ink">{state.created.email}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Пароль</dt>
              <dd className="font-mono text-ink">{state.created.password}</dd>
            </div>
          </dl>
          <button
            type="button"
            onClick={copyCreds}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink transition hover:bg-canvas"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-brand" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Скопировано" : "Скопировать доступы"}
          </button>
        </div>
      )}

      <form action={formAction} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="text-sm font-medium text-ink" htmlFor="full_name">
            Имя сотрудника
          </label>
          <input
            id="full_name"
            name="full_name"
            type="text"
            required
            placeholder="ФИО"
            className="mt-1.5 w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-faint focus:border-brand focus:outline-none"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-ink" htmlFor="role">
            Роль
          </label>
          <select
            id="role"
            name="role"
            required
            defaultValue=""
            className="mt-1.5 w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm text-ink focus:border-brand focus:outline-none"
          >
            <option value="" disabled>
              Выберите роль
            </option>
            {roles.map((r) => (
              <option key={r} value={r}>
                {roleLabel(r)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium text-ink" htmlFor="login">
            Логин <span className="text-faint">— необязательно</span>
          </label>
          <input
            id="login"
            name="login"
            type="text"
            autoComplete="off"
            placeholder="например, ivan"
            className="mt-1.5 w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-faint focus:border-brand focus:outline-none"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-ink" htmlFor="password">
            Пароль <span className="text-faint">— необязательно</span>
          </label>
          <input
            id="password"
            name="password"
            type="text"
            autoComplete="off"
            placeholder="минимум 6 символов"
            className="mt-1.5 w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-faint focus:border-brand focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 sm:col-span-2">
          <p className="text-xs text-muted">
            Логин без «@» → добавим <span className="font-mono">@pulse.team</span>. Пусто — сгенерируем сами.
          </p>
          <button
            type="submit"
            disabled={pending}
            className="inline-flex h-[42px] items-center justify-center gap-2 rounded-xl bg-brand px-5 text-sm font-semibold text-white shadow-soft transition hover:bg-brand-strong disabled:opacity-60"
          >
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <UserPlus className="h-4 w-4" />
            )}
            Создать
          </button>
        </div>
      </form>

      {state.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {state.error}
        </p>
      )}
    </div>
  );
}
