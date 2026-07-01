"use client";

import { useState, useTransition } from "react";
import { Rocket, Loader2, Save } from "lucide-react";
import {
  saveLaunchConfig,
  type LaunchConfig,
  type LeadPage,
} from "@/app/p/[projectId]/ads/integration-actions";

/**
 * Настройки автозапуска рекламы из Telegram-бота: аудитория, тестовый бюджет,
 * куда ведём и от какой страницы. Таргетолог кидает боту видео — эти параметры
 * подставляются в кампанию.
 */
export function LaunchConfigCard({
  projectId,
  config,
  pages,
  defaultDestination,
}: {
  projectId: string;
  config: LaunchConfig;
  pages: LeadPage[];
  defaultDestination: string;
}) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [c, setC] = useState<LaunchConfig>(config);

  const input =
    "rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink placeholder:text-faint focus:border-brand focus:outline-none";
  const set = (patch: Partial<LaunchConfig>) => setC((prev) => ({ ...prev, ...patch }));

  function save() {
    setMsg(null);
    start(async () => {
      const res = await saveLaunchConfig(projectId, c);
      setMsg(res.ok ? { kind: "ok", text: "Настройки запуска сохранены" } : { kind: "err", text: res.error ?? "Ошибка" });
    });
  }

  return (
    <div className="rounded-card bg-surface p-5 shadow-soft ring-1 ring-line">
      <div className="mb-1 flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-soft text-brand-ink">
          <Rocket className="h-5 w-5" />
        </span>
        <div>
          <div className="text-sm font-semibold text-ink">Автозапуск из Telegram</div>
          <div className="text-xs text-muted">Кидаешь боту видео → он собирает рекламу по этим настройкам</div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-xs text-muted">
          Дневной бюджет, $
          <input
            type="number"
            min={1}
            value={c.dailyBudgetUsd}
            onChange={(e) => set({ dailyBudgetUsd: Number(e.target.value) })}
            className={input}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          Возраст от
          <input
            type="number"
            min={13}
            max={65}
            value={c.ageMin}
            onChange={(e) => set({ ageMin: Number(e.target.value) })}
            className={input}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          Возраст до
          <input
            type="number"
            min={13}
            max={65}
            value={c.ageMax}
            onChange={(e) => set({ ageMax: Number(e.target.value) })}
            className={input}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          Пол
          <select value={c.gender} onChange={(e) => set({ gender: e.target.value })} className={input}>
            <option value="all">Все</option>
            <option value="male">Мужчины</option>
            <option value="female">Женщины</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          Страна (код)
          <input
            type="text"
            value={c.country}
            onChange={(e) => set({ country: e.target.value })}
            placeholder="KZ"
            className={input}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          Facebook-страница
          <select
            value={c.pageId ?? ""}
            onChange={(e) => set({ pageId: e.target.value || null })}
            className={input}
          >
            <option value="">Авто (первая)</option>
            {pages.map((p) => (
              <option key={p.pageId} value={p.pageId}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted sm:col-span-2">
          Цель кампании
          <select value={c.objective} onChange={(e) => set({ objective: e.target.value })} className={input}>
            <option value="leads">Лиды — оптимизация под заявки (пиксель)</option>
            <option value="traffic">Трафик — оптимизация по кликам</option>
          </select>
        </label>
      </div>

      <label className="mt-3 flex flex-col gap-1 text-xs text-muted">
        Куда ведёт реклама (ссылка на квиз)
        <input
          type="text"
          value={c.destinationUrl}
          onChange={(e) => set({ destinationUrl: e.target.value })}
          placeholder={defaultDestination}
          className={input}
        />
      </label>

      {pages.length === 0 && (
        <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
          Нет привязанной Facebook-страницы. Нажми «Загрузить страницы» ниже — без страницы объявление не создать.
        </p>
      )}

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-strong disabled:opacity-60"
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Сохранить
        </button>
        {msg && (
          <span className={`text-sm ${msg.kind === "ok" ? "text-brand-ink" : "text-red-600"}`}>{msg.text}</span>
        )}
      </div>
    </div>
  );
}
