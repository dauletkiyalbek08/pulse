"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plug, Loader2, CheckCircle2, AlertTriangle, Link2Off } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import {
  connectMeta,
  disconnectMeta,
  type MetaStatus,
  type AdPurpose,
} from "@/app/p/[projectId]/ads/integration-actions";

export function MetaIntegration({
  projectId,
  purpose,
  title,
  status,
}: {
  projectId: string;
  purpose: AdPurpose;
  title: string;
  status: MetaStatus | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [account, setAccount] = useState("");
  const [token, setToken] = useState("");
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const inputCls =
    "rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink placeholder:text-faint focus:border-brand focus:outline-none";

  function connect() {
    setMsg(null);
    startTransition(async () => {
      const res = await connectMeta(projectId, purpose, account, token);
      setToken("");
      if (!res.ok) {
        setMsg({ kind: "err", text: res.error ?? "Ошибка" });
        return;
      }
      setMsg({ kind: "ok", text: `Подключено: ${res.name} · ${res.currency}` });
      router.refresh();
    });
  }

  function disconnect() {
    if (!confirm("Отключить кабинет? Синхронизированные расходы останутся в истории.")) return;
    startTransition(async () => {
      await disconnectMeta(projectId, purpose);
      setMsg(null);
      router.refresh();
    });
  }

  const badge = (
    <span className="rounded-md bg-canvas px-2 py-0.5 text-xs font-medium text-muted ring-1 ring-line">
      {title}
    </span>
  );

  /* ─────────── Не подключено: компактная кнопка → форма ─────────── */
  if (!status) {
    if (!open) {
      return (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex h-full min-h-[120px] w-full flex-col items-center justify-center gap-2 rounded-card border-2 border-dashed border-line bg-surface p-6 text-center transition hover:border-brand/50 hover:bg-canvas"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-soft text-brand-ink">
            <Plug className="h-5 w-5" />
          </span>
          <span className="text-sm font-semibold text-ink">+ Подключить кабинет · {title}</span>
          <span className="text-xs text-muted">Расходы и кампании подтянутся автоматически</span>
        </button>
      );
    }
    return (
      <div className="flex h-full flex-col rounded-card border border-dashed border-line bg-surface p-5">
        <div className="mb-3 flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-soft text-brand-ink">
            <Plug className="h-5 w-5" />
          </span>
          <div className="text-sm font-semibold text-ink">Кабинет Meta · {title}</div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="ml-auto text-xs text-muted hover:text-ink"
          >
            Свернуть
          </button>
        </div>
        <p className="mb-3 text-xs text-muted">
          Токен (System User Token) хранится только на сервере в зашифрованном виде.
        </p>

        <div className="space-y-2">
          <input
            value={account}
            onChange={(e) => setAccount(e.target.value)}
            placeholder="ID аккаунта (act_… или цифры)"
            className={`${inputCls} w-full`}
          />
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Токен доступа Meta"
            autoComplete="off"
            className={`${inputCls} w-full`}
          />
          <button
            type="button"
            onClick={connect}
            disabled={pending}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-strong disabled:opacity-60"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plug className="h-4 w-4" />}
            Подключить
          </button>
        </div>

        {msg && <Banner msg={msg} />}
      </div>
    );
  }

  /* ─────────── Подключено: статус + синхронизация ─────────── */
  return (
    <div className="flex h-full flex-col rounded-card bg-surface p-5 shadow-soft ring-1 ring-line">
      <div className="mb-2 flex items-center gap-2">
        <span
          className={`flex h-9 w-9 items-center justify-center rounded-xl ${
            status.status === "error" ? "bg-red-50 text-red-600" : "bg-brand-soft text-brand-ink"
          }`}
        >
          {status.status === "error" ? (
            <AlertTriangle className="h-5 w-5" />
          ) : (
            <CheckCircle2 className="h-5 w-5" />
          )}
        </span>
        <div className="text-sm font-semibold text-ink">Кабинет · {title}</div>
        <span className="ml-auto">{badge}</span>
      </div>

      <p className="text-xs text-muted">
        act_{status.adAccountId} · {status.currency}
      </p>
      <p className="text-xs text-faint">
        {status.lastSyncedAt
          ? `обновлено ${formatDateTime(status.lastSyncedAt)}`
          : "ещё не синхронизировано"}
      </p>
      {status.status === "error" && status.lastError && (
        <p className="mt-1 text-xs text-red-600">{status.lastError}</p>
      )}

      <div className="mt-3 flex items-center gap-2">
        <span className="rounded-lg bg-brand-soft px-3 py-1.5 text-xs font-medium text-brand-ink">
          Обновляется автоматически по выбранному периоду
        </span>
        <button
          type="button"
          onClick={disconnect}
          disabled={pending}
          aria-label="Отключить"
          className="ml-auto inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted transition hover:bg-red-50 hover:text-red-600 disabled:opacity-60"
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2Off className="h-4 w-4" />}
        </button>
      </div>

      {msg && <Banner msg={msg} />}
    </div>
  );
}

function Banner({ msg }: { msg: { kind: "ok" | "err"; text: string } }) {
  return (
    <p
      className={`mt-3 rounded-lg px-3 py-2 text-sm ${
        msg.kind === "ok" ? "bg-brand-soft text-brand-ink" : "bg-red-50 text-red-600"
      }`}
    >
      {msg.text}
    </p>
  );
}
