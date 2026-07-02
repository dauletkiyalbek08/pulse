"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { TrendingUp, Loader2, Octagon, BarChart3, ChevronDown, Trophy, Film, ImageIcon, Link2 } from "lucide-react";
import {
  raiseLaunchBudget,
  stopLaunch,
  stopCreative,
  keepBestCreative,
  attributeLeadToCampaign,
  enableAttributionOnLive,
  type LaunchedCampaign,
  type CreativeStat,
  type UnattributedLead,
  type CampaignLead,
} from "@/app/p/[projectId]/ads/launch-actions";

const LEAD_STATUS: Record<string, string> = {
  new: "Новый",
  assigned: "Назначен",
  accepted: "Принят",
  qualified: "Квалифицирован",
  processed: "Обработан",
  trial: "Пробный",
  sale: "Продажа",
};

const VERDICT: Record<LaunchedCampaign["verdict"], { label: string; cls: string }> = {
  good: { label: "Прибыльная", cls: "bg-brand-soft text-brand-ink" },
  ok: { label: "Окупается", cls: "bg-canvas text-muted ring-1 ring-line" },
  bad: { label: "В минус", cls: "bg-red-50 text-red-600" },
  early: { label: "Мало данных", cls: "bg-amber-50 text-amber-700" },
};

const CREATIVE_VERDICT: Record<CreativeStat["verdict"], { label: string; cls: string }> = {
  good: { label: "🏅 сильный", cls: "text-brand-ink" },
  ok: { label: "норм", cls: "text-muted" },
  bad: { label: "слабый", cls: "text-red-600" },
  early: { label: "мало данных", cls: "text-amber-700" },
};

const usd = (n: number, d = 2) => `$${(Math.round(n * 100) / 100).toFixed(d)}`;
const kzt = (n: number) => `${Math.round(n).toLocaleString("ru-RU")} ₸`;

const kztShort = (n: number) => `${Math.round(n).toLocaleString("ru-RU")} ₸`;

export function LaunchedCampaigns({
  projectId,
  campaigns,
  unattributed = [],
}: {
  projectId: string;
  campaigns: LaunchedCampaign[];
  unattributed?: UnattributedLead[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [open, setOpen] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function run(id: string, fn: () => Promise<{ ok: boolean; error?: string }>, okMsg: string) {
    setMsg(null);
    setBusyId(id);
    start(async () => {
      const r = await fn();
      setBusyId(null);
      setMsg(r.ok ? okMsg : r.error ?? "Ошибка");
      if (r.ok) router.refresh();
    });
  }

  function enableAttr() {
    setMsg(null);
    setBusyId("attr-all");
    start(async () => {
      const r = await enableAttributionOnLive(projectId);
      setBusyId(null);
      setMsg(
        r.ok
          ? `Готово: авто-привязка включена на ${r.ads ?? 0} объявлениях. Новые клики привяжутся к креативу сами.`
          : r.error ?? "Ошибка",
      );
      if (r.ok) router.refresh();
    });
  }

  return (
    <div className="rounded-card bg-surface p-5 shadow-soft ring-1 ring-line">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-soft text-brand-ink">
          <BarChart3 className="h-5 w-5" />
        </span>
        <div className="flex-1">
          <div className="text-sm font-semibold text-ink">Запущенные кампании</div>
          <div className="text-xs text-muted">
            Расход, продажи, окупаемость (ROAS) и анализ по креативам. Советы также приходят в бот.
          </div>
        </div>
      </div>

      {campaigns.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg bg-canvas px-3 py-2">
          <span className="flex-1 text-xs text-muted">
            Привязка лида к креативу — автоматическая при клике по рекламе. Для уже запущенных кампаний включи её один раз:
          </span>
          <button
            type="button"
            onClick={enableAttr}
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-strong disabled:opacity-60"
          >
            {busyId === "attr-all" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}
            Включить авто-привязку креативов
          </button>
        </div>
      )}

      {campaigns.length === 0 ? (
        <p className="rounded-lg bg-canvas px-3 py-4 text-center text-sm text-muted">
          Пока нет запущенных авто-кампаний. Запусти через бота (/reklama) или загрузкой видео выше.
        </p>
      ) : (
        <div className="space-y-2.5">
          {campaigns.map((c) => {
            const v = VERDICT[c.verdict];
            const paused = c.status === "paused";
            const expanded = open.has(c.id);
            const hasWinner = c.creatives.some((cr) => cr.isWinner);
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
                  <button
                    type="button"
                    onClick={() => toggle(`leads:${c.id}`)}
                    className="inline-flex items-center gap-1 hover:text-ink"
                  >
                    Лиды: <b className="text-ink">{c.leads}</b>
                    {c.leadRows.length > 0 && <ChevronDown className={`h-3 w-3 transition ${open.has(`leads:${c.id}`) ? "rotate-180" : ""}`} />}
                  </button>
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

                {/* Список лидов, привязанных к кампании */}
                {open.has(`leads:${c.id}`) && (
                  <div className="mt-2 rounded-lg bg-canvas p-2">
                    {c.leadRows.length === 0 ? (
                      <p className="text-[11px] text-muted">
                        Meta насчитала {c.leads} по пикселю, но в CRM к этой кампании пока не привязан ни один
                        лид. Нажми «Включить авто-привязку креативов» вверху — и новые лиды появятся здесь поимённо.
                      </p>
                    ) : (
                      <div className="space-y-1">
                        {c.leadRows.map((lr, i) => (
                          <LeadLine key={i} lr={lr} />
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Креативы */}
                {c.creatives.length > 0 && (
                  <div className="mt-2">
                    <button
                      type="button"
                      onClick={() => toggle(c.id)}
                      className="inline-flex items-center gap-1 text-xs font-medium text-brand-ink hover:underline"
                    >
                      <ChevronDown className={`h-3.5 w-3.5 transition ${expanded ? "rotate-180" : ""}`} />
                      Креативы: {c.creatives.length}
                      {hasWinner && <span className="ml-1 text-amber-600">· есть лидер 🏆</span>}
                    </button>

                    {expanded && (
                      <div className="mt-2 space-y-1.5">
                        {c.creatives.map((cr, i) => (
                          <CreativeRow
                            key={cr.adId}
                            index={i}
                            cr={cr}
                            paused={paused}
                            busy={busyId === `${c.id}:${cr.adId}` && pending}
                            onStop={() =>
                              run(`${c.id}:${cr.adId}`, () => stopCreative(projectId, c.id, cr.adId), "Креатив остановлен.")
                            }
                          />
                        ))}
                        {!paused && hasWinner && c.creatives.length > 1 && (
                          <button
                            type="button"
                            onClick={() =>
                              run(`${c.id}:best`, () => keepBestCreative(projectId, c.id), "Оставлен только лидер.")
                            }
                            disabled={pending}
                            className="mt-1 inline-flex items-center gap-1.5 rounded-lg bg-brand-soft px-3 py-1.5 text-xs font-semibold text-brand-ink transition hover:bg-brand-soft/70 disabled:opacity-60"
                          >
                            <Trophy className="h-3.5 w-3.5" />
                            Оставить только лидер (остальные — стоп)
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Ручная привязка лида/продажи к этой кампании */}
                {unattributed.length > 0 && (
                  <div className="mt-2">
                    <button
                      type="button"
                      onClick={() => toggle(`attr:${c.id}`)}
                      className="inline-flex items-center gap-1 text-xs font-medium text-muted hover:text-ink"
                    >
                      <Link2 className="h-3.5 w-3.5" />
                      Привязать лид/продажу вручную
                    </button>
                    {open.has(`attr:${c.id}`) && (
                      <div className="mt-2 space-y-1.5">
                        <p className="text-[11px] text-muted">
                          Отметь клиента, который пришёл с этой кампании — его продажа попадёт в её выручку/ROAS.
                        </p>
                        {unattributed.map((u) => (
                          <div
                            key={u.leadId}
                            className="flex items-center justify-between gap-2 rounded-lg border border-line bg-surface px-2.5 py-1.5"
                          >
                            <div className="min-w-0 text-xs">
                              <span className="font-medium text-ink">{u.name}</span>
                              <span className="ml-2 text-muted">
                                {u.saleAmount > 0 ? `купил · ${kztShort(u.saleAmount)}` : "без продажи"} ·{" "}
                                {new Date(u.createdAt).toLocaleDateString("ru-RU")}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                run(
                                  `attr:${c.id}:${u.leadId}`,
                                  () => attributeLeadToCampaign(projectId, u.leadId, c.id),
                                  "Привязано к кампании.",
                                )
                              }
                              disabled={pending}
                              className="inline-flex shrink-0 items-center gap-1 rounded-md bg-brand-soft px-2 py-1 text-[11px] font-semibold text-brand-ink transition hover:bg-brand-soft/70 disabled:opacity-60"
                            >
                              {busyId === `attr:${c.id}:${u.leadId}` ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Link2 className="h-3 w-3" />
                              )}
                              Привязать
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {!paused && (
                  <div className="mt-2.5 flex gap-2">
                    <button
                      type="button"
                      onClick={() => run(c.id, () => raiseLaunchBudget(projectId, c.id), "Бюджет поднят на 50%.")}
                      disabled={pending || !c.canScale}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-strong disabled:opacity-60"
                    >
                      {busyId === c.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <TrendingUp className="h-3.5 w-3.5" />}
                      Поднять бюджет +50%
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm("Остановить кампанию?")) run(c.id, () => stopLaunch(projectId, c.id), "Кампания остановлена.");
                      }}
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

function LeadLine({ lr }: { lr: CampaignLead }) {
  return (
    <div className="flex items-center justify-between gap-2 text-[11px]">
      <div className="min-w-0 truncate">
        <span className="font-medium text-ink">{lr.name}</span>
        {lr.phone && <span className="ml-2 text-muted">{lr.phone}</span>}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {lr.bought && <span className="rounded bg-brand-soft px-1.5 py-0.5 font-semibold text-brand-ink">💰 купил</span>}
        <span className="text-muted">{LEAD_STATUS[lr.status] ?? lr.status}</span>
        <span className="text-faint">{new Date(lr.createdAt).toLocaleDateString("ru-RU")}</span>
      </div>
    </div>
  );
}

function CreativeRow({
  index,
  cr,
  paused,
  busy,
  onStop,
}: {
  index: number;
  cr: CreativeStat;
  paused: boolean;
  busy: boolean;
  onStop: () => void;
}) {
  const vv = CREATIVE_VERDICT[cr.verdict];
  return (
    <div
      className={`flex items-center gap-2.5 rounded-lg border p-2 ${
        cr.isWinner ? "border-brand bg-brand-soft/40" : "border-line bg-surface"
      }`}
    >
      <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-md bg-canvas ring-1 ring-line">
        {cr.thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cr.thumb} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-faint">
            {cr.kind === "video" ? <Film className="h-4 w-4" /> : <ImageIcon className="h-4 w-4" />}
          </span>
        )}
        {cr.isWinner && (
          <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-400 text-[9px]">
            🏆
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-xs">
          <span className="font-medium text-ink">Креатив {index + 1}</span>
          <span className={`font-medium ${vv.cls}`}>{vv.label}</span>
        </div>
        <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted">
          <span>{usd(cr.spend)}</span>
          <span>лиды {cr.leads}</span>
          <span>CPL {cr.leads > 0 ? usd(cr.cpl) : "—"}</span>
          <span>прод. {cr.sales}</span>
          <span>ROAS {cr.sales > 0 ? `${cr.roas.toFixed(1)}×` : "—"}</span>
        </div>
      </div>

      {!paused && (
        <button
          type="button"
          onClick={onStop}
          disabled={busy}
          title="Остановить этот креатив"
          className="inline-flex shrink-0 items-center gap-1 rounded-md border border-line bg-surface px-2 py-1 text-[11px] font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Octagon className="h-3 w-3" />}
          Стоп
        </button>
      )}
    </div>
  );
}
