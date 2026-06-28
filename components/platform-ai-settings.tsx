"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, CheckCircle2, Brain, Mic } from "lucide-react";
import {
  savePlatformDeepseek,
  savePlatformOpenai,
  disconnectPlatformDeepseek,
  disconnectPlatformOpenai,
  type PlatformAiSettings as Settings,
} from "@/app/settings/actions";

function KeyBlock({
  icon,
  title,
  subtitle,
  placeholder,
  defaultModel,
  connected,
  model,
  onSave,
  onDisconnect,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  placeholder: string;
  defaultModel: string;
  connected: boolean;
  model: string;
  onSave: (key: string, model: string) => Promise<{ ok: boolean; error?: string }>;
  onDisconnect: () => Promise<{ ok: boolean }>;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [apiKey, setApiKey] = useState("");
  const [mdl, setMdl] = useState(model || defaultModel);
  const [error, setError] = useState<string | null>(null);
  const [edit, setEdit] = useState(false);

  function save() {
    setError(null);
    start(async () => {
      const r = await onSave(apiKey, mdl);
      if (!r.ok) {
        setError(r.error ?? "Ошибка");
        return;
      }
      setApiKey("");
      setEdit(false);
      router.refresh();
    });
  }

  function disconnect() {
    start(async () => {
      await onDisconnect();
      router.refresh();
    });
  }

  const showForm = !connected || edit;

  return (
    <div className="rounded-card bg-surface p-5 shadow-soft ring-1 ring-line">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand-ink">
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-ink">{title}</h3>
            {connected && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-brand-ink">
                <CheckCircle2 className="h-3.5 w-3.5" /> подключён · {model}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-muted">{subtitle}</p>

          {showForm ? (
            <div className="mt-3">
              <div className="grid gap-2 sm:grid-cols-[1fr_180px]">
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={placeholder}
                  className="w-full rounded-xl border border-line bg-canvas px-3 py-2.5 text-sm text-ink placeholder:text-faint focus:border-brand focus:outline-none"
                />
                <input
                  value={mdl}
                  onChange={(e) => setMdl(e.target.value)}
                  placeholder={defaultModel}
                  className="w-full rounded-xl border border-line bg-canvas px-3 py-2.5 text-sm text-ink placeholder:text-faint focus:border-brand focus:outline-none"
                />
              </div>
              {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={save}
                  disabled={pending || !apiKey.trim()}
                  className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-strong disabled:opacity-50"
                >
                  {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {connected ? "Сохранить новый ключ" : "Подключить"}
                </button>
                {connected && (
                  <button
                    type="button"
                    onClick={() => {
                      setEdit(false);
                      setApiKey("");
                      setError(null);
                    }}
                    className="rounded-xl border border-line px-3 py-2.5 text-sm text-muted transition hover:bg-canvas"
                  >
                    Отмена
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setEdit(true)}
                className="rounded-xl border border-line bg-canvas px-3 py-2 text-sm text-ink transition hover:bg-surface"
              >
                Заменить ключ
              </button>
              <button
                type="button"
                onClick={disconnect}
                disabled={pending}
                className="rounded-xl border border-line px-3 py-2 text-sm text-muted transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
              >
                Отключить
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Платформенные ключи ИИ — один набор владельца на все проекты. */
export function PlatformAiSettings({ settings }: { settings: Settings }) {
  return (
    <div className="space-y-4">
      <KeyBlock
        icon={<Brain className="h-5 w-5" />}
        title="DeepSeek — анализ звонков"
        subtitle="Оценивает текст разговора по правилам отдела. Понимает казахский и русский. Обязателен."
        placeholder="sk-… (API-ключ DeepSeek)"
        defaultModel="deepseek-chat"
        connected={settings.deepseekConnected}
        model={settings.deepseekModel}
        onSave={savePlatformDeepseek}
        onDisconnect={disconnectPlatformDeepseek}
      />
      <KeyBlock
        icon={<Mic className="h-5 w-5" />}
        title="OpenAI Whisper — распознавание речи"
        subtitle="Превращает аудиозаписи звонков в текст. Нужен только для загрузки аудио (по желанию)."
        placeholder="sk-… (API-ключ OpenAI)"
        defaultModel="whisper-1"
        connected={settings.openaiConnected}
        model={settings.asrModel}
        onSave={savePlatformOpenai}
        onDisconnect={disconnectPlatformOpenai}
      />
    </div>
  );
}
