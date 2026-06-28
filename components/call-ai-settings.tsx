"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, Settings2, CheckCircle2, Mic, ExternalLink } from "lucide-react";
import { updateCallRules } from "@/app/p/[projectId]/calls/actions";

export interface CallAiStatus {
  connected: boolean;
  model: string;
  usingPlatformKey: boolean;
  hasProjectKey: boolean;
  salesRules: string;
  hunterRules: string;
  asrConnected: boolean;
  asrModel: string;
  usingPlatformAsr: boolean;
  hasProjectAsr: boolean;
  lastError: string | null;
}

/** Источник ключа — чип «ключи платформы» / «ключ проекта». */
function SourceChip({ platform }: { platform: boolean }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
        platform ? "bg-brand-soft text-brand-ink" : "bg-canvas text-muted ring-1 ring-line"
      }`}
    >
      {platform ? "ключи платформы" : "ключ проекта"}
    </span>
  );
}

/** Статус ИИ-анализа в проекте + правила отдела. Ключи задаёт владелец в «Настройках платформы». */
export function CallAiSettings({
  projectId,
  status,
  canManage,
  isOwner,
}: {
  projectId: string;
  status: CallAiStatus | null;
  canManage: boolean;
  isOwner: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const [open, setOpen] = useState(false);
  const [salesRules, setSalesRules] = useState(status?.salesRules ?? "");
  const [hunterRules, setHunterRules] = useState(status?.hunterRules ?? "");
  const [saved, setSaved] = useState(false);

  function saveRules() {
    setSaved(false);
    start(async () => {
      await updateCallRules(projectId, salesRules, hunterRules);
      setSaved(true);
      router.refresh();
    });
  }

  // Не настроено: нет ни платформенного, ни проектного ключа
  if (!status?.connected) {
    return (
      <div className="rounded-card border border-dashed border-line bg-surface px-6 py-8 text-center">
        <p className="text-sm font-medium text-ink">ИИ-анализ звонков ещё не настроен</p>
        {isOwner ? (
          <>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted">
              Добавьте ключ DeepSeek в «Настройках платформы» — один раз на все проекты.
            </p>
            <Link
              href="/settings"
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-strong"
            >
              <Settings2 className="h-4 w-4" /> Открыть настройки платформы
            </Link>
          </>
        ) : (
          <p className="mx-auto mt-1 max-w-md text-sm text-muted">
            Подключение настраивает владелец платформы.
          </p>
        )}
      </div>
    );
  }

  // Настроено
  return (
    <div className="rounded-card bg-surface p-5 shadow-soft ring-1 ring-line">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <CheckCircle2 className="h-5 w-5 text-brand" />
          <span className="font-semibold text-ink">DeepSeek подключён</span>
          <span className="text-muted">· {status.model}</span>
          <SourceChip platform={status.usingPlatformKey} />
          {status.lastError && <span className="text-red-600">· ошибка: {status.lastError}</span>}
        </div>
        {canManage && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-canvas px-3 py-2 text-sm text-ink transition hover:bg-surface"
          >
            <Settings2 className="h-4 w-4 text-muted" /> Правила отдела
          </button>
        )}
      </div>

      {/* Распознавание речи */}
      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4 text-sm">
        <Mic className="h-4 w-4 text-muted" />
        <span className="font-medium text-ink">Распознавание речи</span>
        {status.asrConnected ? (
          <>
            <span className="text-muted">· {status.asrModel}</span>
            <SourceChip platform={status.usingPlatformAsr} />
          </>
        ) : (
          <span className="text-faint">· не подключено (нужно для загрузки аудио)</span>
        )}
        {!status.asrConnected && isOwner && (
          <Link href="/settings" className="inline-flex items-center gap-1 text-xs text-brand-ink hover:underline">
            настроить <ExternalLink className="h-3 w-3" />
          </Link>
        )}
      </div>

      {/* Правила отдела (per-project) */}
      {canManage && open && (
        <div className="mt-5 space-y-4 border-t border-line pt-5">
          <p className="text-xs text-muted">
            Правила оценки звонков — свои для каждого проекта. По ним ИИ выставляет баллы.
          </p>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-muted">Правила для менеджеров (продажи)</label>
              <textarea
                value={salesRules}
                onChange={(e) => {
                  setSalesRules(e.target.value);
                  setSaved(false);
                }}
                rows={7}
                className="mt-1 w-full rounded-xl border border-line bg-canvas px-3 py-2.5 text-sm text-ink focus:border-brand focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted">Правила для хантеров</label>
              <textarea
                value={hunterRules}
                onChange={(e) => {
                  setHunterRules(e.target.value);
                  setSaved(false);
                }}
                rows={7}
                className="mt-1 w-full rounded-xl border border-line bg-canvas px-3 py-2.5 text-sm text-ink focus:border-brand focus:outline-none"
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={saveRules}
              disabled={pending}
              className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-strong disabled:opacity-50"
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Сохранить правила
            </button>
            {saved && <span className="text-sm text-brand-ink">Сохранено</span>}
          </div>
        </div>
      )}
    </div>
  );
}
