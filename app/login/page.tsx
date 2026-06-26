"use client";

import { useActionState } from "react";
import { Activity, Loader2 } from "lucide-react";
import { login, type LoginState } from "./actions";

const initialState: LoginState = { error: null };

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, initialState);

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand text-white shadow-soft">
            <Activity className="h-6 w-6" strokeWidth={2.5} />
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-ink">
            Вход в Pulse
          </h1>
          <p className="mt-1.5 text-sm text-muted">
            Платформа управления рекламными проектами
          </p>
        </div>

        <form
          action={formAction}
          className="rounded-card bg-surface p-7 shadow-card ring-1 ring-line"
        >
          <label className="block text-sm font-medium text-ink" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="you@example.com"
            className="mt-1.5 w-full rounded-xl border border-line bg-canvas px-3.5 py-2.5 text-sm text-ink placeholder:text-faint focus:border-brand focus:bg-surface focus:outline-none"
          />

          <label
            className="mt-4 block text-sm font-medium text-ink"
            htmlFor="password"
          >
            Пароль
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            placeholder="••••••••"
            className="mt-1.5 w-full rounded-xl border border-line bg-canvas px-3.5 py-2.5 text-sm text-ink placeholder:text-faint focus:border-brand focus:bg-surface focus:outline-none"
          />

          {state.error && (
            <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              {state.error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-brand-strong disabled:opacity-60"
          >
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            {pending ? "Вход..." : "Войти"}
          </button>
        </form>
      </div>
    </div>
  );
}
