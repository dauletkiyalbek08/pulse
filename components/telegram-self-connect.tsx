"use client";

import { useState, useTransition } from "react";
import { Send, Loader2, Copy, Check, X } from "lucide-react";
import { connectMyTelegram } from "@/app/p/[projectId]/settings/actions";

/**
 * Баннер самоподключения Telegram: сотрудник, зашедший под своим аккаунтом,
 * сам привязывает свой Telegram (получать лиды, отмечать смену в боте).
 * Показывается, пока пользователь не привязан.
 */
export function TelegramSelfConnect({ projectId }: { projectId: string }) {
  const [pending, startTransition] = useTransition();
  const [url, setUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (hidden) return null;

  function connect() {
    setError(null);
    startTransition(async () => {
      const res = await connectMyTelegram(projectId);
      if (res.ok && res.url) {
        setUrl(res.url);
        window.open(res.url, "_blank", "noopener,noreferrer");
      } else {
        setError(res.error ?? "Не удалось создать ссылку");
      }
    });
  }

  async function copy() {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="border-b border-brand/20 bg-brand-soft/60">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-6 py-2.5">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand text-white">
          <Send className="h-4 w-4" />
        </span>
        <p className="min-w-0 flex-1 text-sm text-ink">
          <span className="font-medium">Подключите Telegram</span>
          <span className="text-muted"> — получайте новых лидов и отмечайте смену прямо в боте.</span>
        </p>

        {url ? (
          <div className="flex items-center gap-2 rounded-lg bg-surface px-2 py-1 text-xs ring-1 ring-line">
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="max-w-[200px] truncate font-mono text-brand-ink hover:underline"
            >
              {url}
            </a>
            <button
              type="button"
              onClick={copy}
              className="inline-flex items-center rounded-md border border-line px-1.5 py-1 text-muted transition hover:text-ink"
              title="Скопировать ссылку"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-brand" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={connect}
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-white transition hover:bg-brand-strong disabled:opacity-60"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Подключить Telegram
          </button>
        )}

        <button
          type="button"
          onClick={() => setHidden(true)}
          className="rounded-md p-1 text-muted transition hover:text-ink"
          title="Скрыть"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      {error && <p className="mx-auto max-w-6xl px-6 pb-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
