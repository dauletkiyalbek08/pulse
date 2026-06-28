"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Settings2, CheckCircle2, Mic } from "lucide-react";
import {
  connectCallAi,
  disconnectCallAi,
  updateCallRules,
  connectAsr,
  disconnectAsr,
} from "@/app/p/[projectId]/calls/actions";

export interface CallAiStatus {
  connected: boolean;
  model: string;
  status: string;
  lastError: string | null;
  salesRules: string;
  hunterRules: string;
  asrConnected: boolean;
  asrModel: string;
}

/** Подключение DeepSeek + правила оценки (для директора/РОП). */
export function CallAiSettings({
  projectId,
  status,
  canManage,
}: {
  projectId: string;
  status: CallAiStatus | null;
  canManage: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Подключение
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("deepseek-chat");

  // Правила
  const [open, setOpen] = useState(false);
  const [salesRules, setSalesRules] = useState(status?.salesRules ?? "");
  const [hunterRules, setHunterRules] = useState(status?.hunterRules ?? "");
  const [saved, setSaved] = useState(false);

  // Распознавание речи (OpenAI)
  const [asrKey, setAsrKey] = useState("");
  const [asrModel, setAsrModel] = useState(status?.asrModel || "whisper-1");
  const [asrError, setAsrError] = useState<string | null>(null);

  function connectAsrFn() {
    setAsrError(null);
    start(async () => {
      const r = await connectAsr(projectId, asrKey, asrModel);
      if (!r.ok) {
        setAsrError(r.error ?? "Ошибка подключения");
        return;
      }
      setAsrKey("");
      router.refresh();
    });
  }

  function disconnectAsrFn() {
    start(async () => {
      await disconnectAsr(projectId);
      router.refresh();
    });
  }

  function connect() {
    setError(null);
    start(async () => {
      const r = await connectCallAi(projectId, apiKey, model);
      if (!r.ok) {
        setError(r.error ?? "Ошибка подключения");
        return;
      }
      setApiKey("");
      router.refresh();
    });
  }

  function saveRules() {
    setSaved(false);
    start(async () => {
      await updateCallRules(projectId, salesRules, hunterRules);
      setSaved(true);
      router.refresh();
    });
  }

  function disconnect() {
    start(async () => {
      await disconnectCallAi(projectId);
      router.refresh();
    });
  }

  // Не подключено
  if (!status?.connected) {
    if (!canManage) {
      return (
        <div className="rounded-card border border-dashed border-line bg-surface px-6 py-8 text-center text-sm text-muted">
          ИИ-анализ звонков ещё не подключён. Обратитесь к директору или РОП.
        </div>
      );
    }
    return (
      <div className="rounded-card bg-surface p-6 shadow-soft ring-1 ring-line">
        <h2 className="text-base font-semibold text-ink">Подключить DeepSeek</h2>
        <p className="mt-0.5 text-sm text-muted">
          Вставьте API-ключ DeepSeek — он хранится зашифрованно на сервере и не попадает в браузер.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_200px]">
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-… (API-ключ DeepSeek)"
            className="w-full rounded-xl border border-line bg-canvas px-3 py-2.5 text-sm text-ink placeholder:text-faint focus:border-brand focus:outline-none"
          />
          <input
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="deepseek-chat"
            className="w-full rounded-xl border border-line bg-canvas px-3 py-2.5 text-sm text-ink placeholder:text-faint focus:border-brand focus:outline-none"
          />
        </div>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        <button
          type="button"
          onClick={connect}
          disabled={pending || !apiKey.trim()}
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-strong disabled:opacity-50"
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Подключить
        </button>
      </div>
    );
  }

  // Подключено
  return (
    <div className="rounded-card bg-surface p-5 shadow-soft ring-1 ring-line">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm">
          <CheckCircle2 className="h-5 w-5 text-brand" />
          <span className="font-semibold text-ink">DeepSeek подключён</span>
          <span className="text-muted">· {status.model}</span>
          {status.status === "error" && status.lastError && (
            <span className="text-red-600">· ошибка: {status.lastError}</span>
          )}
        </div>
        {canManage && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-canvas px-3 py-2 text-sm text-ink transition hover:bg-surface"
          >
            <Settings2 className="h-4 w-4 text-muted" /> Правила и доступ
          </button>
        )}
      </div>

      {canManage && (
        <div className="mt-4 border-t border-line pt-4">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Mic className="h-4 w-4 text-muted" />
            <span className="font-medium text-ink">Распознавание речи</span>
            {status.asrConnected ? (
              <span className="text-muted">· подключено ({status.asrModel})</span>
            ) : (
              <span className="text-faint">· не подключено (нужно для загрузки аудио)</span>
            )}
          </div>
          {status.asrConnected ? (
            <button
              type="button"
              onClick={disconnectAsrFn}
              disabled={pending}
              className="mt-2 rounded-xl border border-line px-3 py-1.5 text-xs text-muted transition hover:bg-red-50 hover:text-red-600"
            >
              Отключить распознавание
            </button>
          ) : (
            <div className="mt-2">
              <p className="mb-2 text-xs text-muted">
                API-ключ OpenAI (Whisper) для загрузки аудиозаписей. Хранится зашифрованно на сервере.
              </p>
              <div className="grid gap-2 sm:grid-cols-[1fr_180px]">
                <input
                  type="password"
                  value={asrKey}
                  onChange={(e) => setAsrKey(e.target.value)}
                  placeholder="sk-… (API-ключ OpenAI)"
                  className="w-full rounded-xl border border-line bg-canvas px-3 py-2 text-sm text-ink placeholder:text-faint focus:border-brand focus:outline-none"
                />
                <input
                  value={asrModel}
                  onChange={(e) => setAsrModel(e.target.value)}
                  placeholder="whisper-1"
                  className="w-full rounded-xl border border-line bg-canvas px-3 py-2 text-sm text-ink placeholder:text-faint focus:border-brand focus:outline-none"
                />
              </div>
              {asrError && <p className="mt-2 text-sm text-red-600">{asrError}</p>}
              <button
                type="button"
                onClick={connectAsrFn}
                disabled={pending || !asrKey.trim()}
                className="mt-2 inline-flex items-center gap-2 rounded-xl bg-brand px-3 py-2 text-sm font-medium text-white transition hover:bg-brand-strong disabled:opacity-50"
              >
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Подключить распознавание
              </button>
            </div>
          )}
        </div>
      )}

      {canManage && open && (
        <div className="mt-5 space-y-4 border-t border-line pt-5">
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
            <button
              type="button"
              onClick={disconnect}
              disabled={pending}
              className="ml-auto rounded-xl border border-line px-3 py-2 text-sm text-muted transition hover:bg-red-50 hover:text-red-600"
            >
              Отключить
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
