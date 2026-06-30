"use client";

import { useState, useTransition } from "react";
import { Send, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { setupTelegramWebhook, type TelegramStatus } from "@/app/settings/actions";

export function TelegramWebhookSettings({ status }: { status: TelegramStatus }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  function reinstall() {
    setResult(null);
    start(async () => {
      const r = await setupTelegramWebhook();
      setResult({ ok: r.ok, msg: r.ok ? "Вебхук установлен. Бот готов принимать сообщения." : r.error ?? "Ошибка" });
    });
  }

  return (
    <div className="rounded-card bg-surface p-6 shadow-soft ring-1 ring-line">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand text-white">
              <Send className="h-4 w-4" />
            </span>
            <div>
              <div className="font-semibold text-ink">
                {status.configured ? status.username ?? "Бот подключён" : "Бот не настроен"}
              </div>
              <div className="text-xs text-muted">
                {!status.configured
                  ? "Добавьте TELEGRAM_BOT_TOKEN в Vercel и сделайте Redeploy"
                  : status.webhookSet
                    ? "Вебхук активен ✓"
                    : "Вебхук не установлен — нажмите кнопку"}
              </div>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={reinstall}
          disabled={pending || !status.configured}
          className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-strong disabled:opacity-50"
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Переустановить вебхук
        </button>
      </div>

      {result && (
        <div
          className={`mt-4 flex items-start gap-2 rounded-tile px-3 py-2 text-sm ${
            result.ok ? "bg-brand-soft text-brand-ink" : "bg-red-50 text-red-600"
          }`}
        >
          {result.ok ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <span>{result.msg}</span>
        </div>
      )}

      <p className="mt-4 text-xs text-muted">
        Сменил бота? Обнови в Vercel <span className="font-medium text-ink">TELEGRAM_BOT_TOKEN</span> и{" "}
        <span className="font-medium text-ink">TELEGRAM_BOT_USERNAME</span>, сделай Redeploy — затем нажми
        «Переустановить вебхук». Токен в браузер не попадает: запрос к Telegram идёт с сервера.
      </p>
    </div>
  );
}
