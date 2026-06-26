"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plug, RefreshCw, Loader2, CheckCircle2, AlertTriangle, Link2Off } from "lucide-react";
import { formatCurrency, formatDateTime } from "@/lib/format";
import {
  connectMeta,
  disconnectMeta,
  syncMeta,
  type MetaStatus,
} from "@/app/p/[projectId]/ads/integration-actions";

export function MetaIntegration({
  projectId,
  status,
  rangeFrom,
  rangeTo,
  rangeLabel,
}: {
  projectId: string;
  status: MetaStatus | null;
  rangeFrom: string;
  rangeTo: string;
  rangeLabel: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [account, setAccount] = useState("");
  const [token, setToken] = useState("");
  const [rate, setRate] = useState("480");
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const inputCls =
    "rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink placeholder:text-faint focus:border-brand focus:outline-none";

  function connect() {
    setMsg(null);
    startTransition(async () => {
      const res = await connectMeta(projectId, account, token, Number(rate || 0));
      setToken("");
      if (!res.ok) {
        setMsg({ kind: "err", text: res.error ?? "Ошибка" });
        return;
      }
      setMsg({ kind: "ok", text: `Подключено: ${res.name} · ${res.currency}` });
      router.refresh();
    });
  }

  function sync() {
    setMsg(null);
    startTransition(async () => {
      const res = await syncMeta(projectId, rangeFrom, rangeTo);
      if (!res.ok) {
        setMsg({ kind: "err", text: res.error ?? "Ошибка синхронизации" });
        return;
      }
      setMsg({
        kind: "ok",
        text: `Синхронизировано: ${formatCurrency(res.total ?? 0)} · ${res.days ?? 0} дн. · ${res.leads ?? 0} лид(ов)`,
      });
      router.refresh();
    });
  }

  function disconnect() {
    if (!confirm("Отключить Meta Ads? Синхронизированные расходы останутся в истории.")) return;
    startTransition(async () => {
      await disconnectMeta(projectId);
      setMsg(null);
      router.refresh();
    });
  }

  /* ─────────── Не подключено: форма ─────────── */
  if (!status) {
    return (
      <div className="rounded-card border border-dashed border-line bg-surface p-5">
        <div className="mb-3 flex items-start gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-soft text-brand-ink">
            <Plug className="h-5 w-5" />
          </span>
          <div>
            <div className="text-sm font-semibold text-ink">Подключить Meta Ads</div>
            <p className="mt-0.5 max-w-xl text-sm text-muted">
              Расходы и лиды будут подтягиваться автоматически. Токен (System User Token)
              хранится только на сервере в зашифрованном виде и в браузер не передаётся.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <input
            value={account}
            onChange={(e) => setAccount(e.target.value)}
            placeholder="ID аккаунта (act_… или цифры)"
            className={inputCls}
          />
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Токен доступа Meta"
            autoComplete="off"
            className={`${inputCls} sm:col-span-2`}
          />
        </div>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="flex items-center gap-2 text-sm text-muted">
            Курс валюты кабинета к ₸
            <input
              type="number"
              min={1}
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              className={`${inputCls} w-24`}
            />
          </label>
          <span className="text-xs text-faint">Если кабинет в ₸ — оставьте 1.</span>
          <button
            type="button"
            onClick={connect}
            disabled={pending}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand px-5 py-2 text-sm font-semibold text-white transition hover:bg-brand-strong disabled:opacity-60 sm:ml-auto"
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
    <div className="rounded-card bg-surface p-5 shadow-soft ring-1 ring-line">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span
            className={`flex h-10 w-10 items-center justify-center rounded-xl ${
              status.status === "error" ? "bg-red-50 text-red-600" : "bg-brand-soft text-brand-ink"
            }`}
          >
            {status.status === "error" ? (
              <AlertTriangle className="h-5 w-5" />
            ) : (
              <CheckCircle2 className="h-5 w-5" />
            )}
          </span>
          <div>
            <div className="text-sm font-semibold text-ink">
              Meta Ads подключён · act_{status.adAccountId}
            </div>
            <p className="mt-0.5 text-sm text-muted">
              Валюта: {status.currency}
              {status.currency !== "KZT" && ` · курс ${status.kztRate} ₸`} ·{" "}
              {status.lastSyncedAt
                ? `обновлено ${formatDateTime(status.lastSyncedAt)}`
                : "ещё не синхронизировано"}
            </p>
            {status.status === "error" && status.lastError && (
              <p className="mt-1 text-xs text-red-600">{status.lastError}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={sync}
            disabled={pending}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-strong disabled:opacity-60"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Синхронизировать ({rangeLabel})
          </button>
          <button
            type="button"
            onClick={disconnect}
            disabled={pending}
            aria-label="Отключить"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted transition hover:bg-red-50 hover:text-red-600 disabled:opacity-60"
          >
            <Link2Off className="h-4 w-4" />
          </button>
        </div>
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
