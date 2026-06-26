"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Inbox, Loader2, Copy, Check, RefreshCw } from "lucide-react";
import { linkLeadPages, type LeadPage } from "@/app/p/[projectId]/ads/integration-actions";

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div>
      <div className="mb-1 text-xs text-muted">{label}</div>
      <div className="flex items-center gap-2 rounded-lg border border-line bg-canvas px-3 py-2">
        <code className="min-w-0 flex-1 truncate text-xs text-ink">{value}</code>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="shrink-0 text-muted transition hover:text-ink"
          aria-label="Копировать"
        >
          {copied ? <Check className="h-4 w-4 text-brand-ink" /> : <Copy className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

export function LeadAdsSetup({
  projectId,
  webhookUrl,
  verifyToken,
  pages,
  connected,
}: {
  projectId: string;
  webhookUrl: string;
  verifyToken: string;
  pages: LeadPage[];
  connected: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  function loadPages() {
    setMsg(null);
    startTransition(async () => {
      const res = await linkLeadPages(projectId);
      if (!res.ok) setMsg({ kind: "err", text: res.error ?? "Ошибка" });
      else {
        setMsg({ kind: "ok", text: `Привязано страниц: ${res.count}` });
        router.refresh();
      }
    });
  }

  return (
    <div className="rounded-card bg-surface p-5 shadow-soft ring-1 ring-line">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-soft text-brand-ink">
          <Inbox className="h-5 w-5" />
        </span>
        <div>
          <div className="text-sm font-semibold text-ink">Заявки с форм Meta (Lead Ads)</div>
          <p className="text-xs text-muted">
            Заявки сами попадут в CRM-воронку и хантерам в Telegram, с привязкой к креативу.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <CopyField label="URL вебхука (Callback URL)" value={webhookUrl} />
        <CopyField label="Verify Token" value={verifyToken} />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={loadPages}
          disabled={pending || !connected}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-strong disabled:opacity-60"
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Загрузить мои страницы
        </button>
        {!connected && <span className="text-xs text-faint">Сначала подключите кабинет Meta</span>}
        {pages.length > 0 && (
          <span className="text-xs text-muted">
            Привязано: {pages.map((p) => p.name).join(", ")}
          </span>
        )}
      </div>

      {msg && (
        <p
          className={`mt-3 rounded-lg px-3 py-2 text-sm ${
            msg.kind === "ok" ? "bg-brand-soft text-brand-ink" : "bg-red-50 text-red-600"
          }`}
        >
          {msg.text}
        </p>
      )}
    </div>
  );
}
