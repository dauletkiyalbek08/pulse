"use client";

import { useActionState, useState } from "react";
import { Loader2, Users } from "lucide-react";
import { LogoMark } from "@/components/logo";
import { login, type LoginState } from "./actions";

const initialState: LoginState = { error: null };

/** Демо-входы: один клик подставляет логин/пароль, дальше жмёшь «Войти». */
const DEMO_PASSWORD = "demo1234";
const DEMO_ACCOUNTS: { label: string; name: string; email: string }[] = [
  { label: "Директор", name: "Соколова А. В.", email: "director@demo.pulse" },
  { label: "Руководитель продаж", name: "Руслан Жаксыбаев", email: "head_sales@demo.pulse" },
  { label: "Менеджер", name: "Динара Касымова", email: "manager@demo.pulse" },
  { label: "Хантер", name: "Ерлан Сериков", email: "hunter@demo.pulse" },
  { label: "Хантер", name: "Сергей Волков", email: "emp4.english@pulse.demo" },
  { label: "Учитель", name: "Мария Лебедева", email: "teacher@demo.pulse" },
  { label: "Маркетолог", name: "Сабина Ермекова", email: "marketer@demo.pulse" },
  { label: "Таргетолог", name: "Данияр Оспанов", email: "targetologist@demo.pulse" },
  { label: "SMM", name: "Камила Идрисова", email: "smm@demo.pulse" },
  { label: "Бухгалтер", name: "Гульнара Сейтова", email: "accountant@demo.pulse" },
];

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, initialState);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  function fillDemo(demoEmail: string) {
    setEmail(demoEmail);
    setPassword(DEMO_PASSWORD);
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <span className="mb-4 inline-block overflow-hidden rounded-2xl shadow-soft">
            <LogoMark className="h-14 w-14" />
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
            value={email}
            onChange={(e) => setEmail(e.target.value)}
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
            value={password}
            onChange={(e) => setPassword(e.target.value)}
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

        {/* Быстрый вход под разными ролями (демо) */}
        <div className="mt-6 rounded-card bg-surface p-5 shadow-soft ring-1 ring-line">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink">
            <Users className="h-4 w-4 text-brand-ink" />
            Быстрый вход (демо)
          </div>
          <p className="mb-3 text-xs text-muted">
            Нажми роль — логин и пароль подставятся. Затем нажми «Войти».
          </p>
          <div className="grid grid-cols-2 gap-2">
            {DEMO_ACCOUNTS.map((acc) => {
              const selected = email === acc.email;
              return (
                <button
                  key={acc.email}
                  type="button"
                  onClick={() => fillDemo(acc.email)}
                  className={`rounded-xl border px-3 py-2 text-left transition ${
                    selected
                      ? "border-brand bg-brand-soft text-brand-ink"
                      : "border-line bg-canvas text-ink hover:border-brand/40 hover:bg-brand-soft/40"
                  }`}
                >
                  <span className="block truncate text-sm font-medium">{acc.name}</span>
                  <span className="block truncate text-xs text-muted">{acc.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
