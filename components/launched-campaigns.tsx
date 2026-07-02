"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { TrendingUp, Loader2, Octagon, BarChart3 } from "lucide-react";
import {
  raiseLaunchBudget,
  stopLaunch,
  type LaunchedCampaign,
} from "@/app/p/[projectId]/ads/launch-actions";

const VERDICT: Record<LaunchedCampaign["verdict"], { label: string; cls: string }> = {
  good: { label: "Прибыльная", cls: "bg-brand-soft text-brand-ink" },
  ok: { label: "Окупается", cls: "bg-canvas text-muted ring-1 ring-line" },
  bad: { label: "В минус", cls: "bg-red-50 text-red-600" },
  early: { label: "Мало данных", cls: "bg-amber-50 text-amber-700" },
};

const usd = (n: number, d = 2) => `$${(Math.round(n * 100) / 100).toFixed(d)}`;
const kzt = (n: number) => `${Math.round(n).toLocaleString("ru-RU")} ₸`;

export function LaunchedCampaigns({
  projectId,
  campaigns,
}: {
  projectId: string;
  campaigns: LaunchedCampaign[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  function raise(id: string) {
    setMsg(null);
    setBusyId(id);
    start(async () => {
      const r = await raiseLaunchBudget(projectId, id);
      setBusyId(null);
      setMsg(r.ok ? "Бюджет поднят на 50%." : r.error ?? "Ошибка");
      if (r.ok) router.refresh();
    });
  }

  function stop(id: string) {
    if (!confirm("Остановить кампанию?")) return;
    setMsg(null);
    setBusyId(id);
    start(async () => {
      const r = await stopLaunch(projectId, id);
      setBusyId(null);
      setMsg(r.ok ? "Кампания остановлена." : r.error ?? "Ошибка");
      if (r.ok) router.refresh();
    });
  }

  return (
    <div className="rounded-card bg-surface p-5 shadow-soft ring-1 ring-line">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-soft text-brand-ink">
          <BarChart3 className="h-5 w-5" />
        </span>
        <div>
          <div className="text-sm font-semibold text-ink">Запущенные кампании</div>
          <div className="text-xs text-muted">Анализ Pulse: расход, продажи, окупаемость (ROAS) и действия. Советы также приходят в бот.</div>
        </div>
      </div>

      {campaigns.length === 0 ? (
        <p className="rounded-lg bg-canvas px-3 py-4 text-center text-sm text-muted">
          Пока нет запущенных авто-кампаний. Запусти через бота (/reklama) или загрузкой видео выше.
        </p>
      ) : (
        <div className="space-y-2.5">
          {campaigns.map((c) => {
            const v = VERDICT[c.verdict];
            const paused = c.status === "paused";
            return (
              <div key={c.id} className="rounded-xl border border-line bg-canvas p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-ink">{c.headline}</div>
                    <div className="text-xs text-muted">
                      {new Date(c.createdAt).toLocaleDateString("ru-RU")} · бюджет {usd(c.budgetUsd, 0)}/день
                      {paused && " · ⏸ на паузе"}
                    </div>
                  </div>
                  <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${v.cls}`}>{v.label}</span>
                </div>

                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                  <span>Расход: <b className="text-ink">{usd(c.spend)}</b></span>
                  <span>Лиды: <b className="text-ink">{c.leads}</b></span>
                  <span>CPL: <b className="text-ink">{c.leads > 0 ? usd(c.cpl) : "—"}</b></span>
                  <span>Продажи: <b className="text-ink">{c.sales}</b></span>
                  <span>Выручка: <b className="text-ink">{c.revenueKzt > 0 ? kzt(c.revenueKzt) : "—"}</b></span>
                  <span>
                    ROAS:{" "}
                    <b className={c.sales > 0 ? (c.roas >= 1 ? "text-brand-ink" : "text-red-600") : "text-ink"}>
                      {c.sales > 0 ? `${c.roas.toFixed(1)}×` : "—"}
                    </b>
                  </span>
                  {c.sales > 0 && <span>Цена продажи: <b className="text-ink">{usd(c.costPerSaleUsd)}</b></span>}
                </div>

                {!paused && (
                  <div className="mt-2.5 flex gap-2">
                    <button
                      type="button"
                      onClick={() => raise(c.id)}
                      disabled={pending || !c.canScale}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-strong disabled:opacity-60"
                    >
                      {busyId === c.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <TrendingUp className="h-3.5 w-3.5" />}
                      Поднять бюджет +50%
                    </button>
                    <button
                      type="button"
                      onClick={() => stop(c.id)}
                      disabled={pending}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-60"
                    >
                      <Octagon className="h-3.5 w-3.5" />
                      Остановить
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {msg && <p className="mt-3 text-sm text-brand-ink">{msg}</p>}
    </div>
  );
}
