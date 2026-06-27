"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Webhook, Loader2, Send, Plug, CheckCircle2, Unplug } from "lucide-react";
import {
  connectCapi,
  disconnectCapi,
  sendCapiTest,
  type CapiStatus,
} from "@/app/p/[projectId]/capi/actions";
import { formatDateTime } from "@/lib/format";

export function CapiIntegration({
  projectId,
  status,
  defaultDatasetId,
}: {
  projectId: string;
  status: CapiStatus | null;
  defaultDatasetId: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [datasetId, setDatasetId] = useState(status?.datasetId ?? defaultDatasetId);
  const [token, setToken] = useState("");
  const [testCode, setTestCode] = useState(status?.testEventCode ?? "");
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  function connect() {
    setMsg(null);
    start(async () => {
      const res = await connectCapi(projectId, datasetId, token, testCode);
      if (!res.ok) setMsg({ kind: "err", text: res.error ?? "Ошибка" });
      else {
        setMsg({ kind: "ok", text: `Подключено: ${res.name}` });
        setToken("");
        router.refresh();
      }
    });
  }

  function disconnect() {
    start(async () => {
      await disconnectCapi(projectId);
      router.refresh();
    });
  }

  function test() {
    setMsg(null);
    start(async () => {
      const res = await sendCapiTest(projectId);
      setMsg(res.ok ? { kind: "ok", text: res.message ?? "Отправлено" } : { kind: "err", text: res.error ?? "Ошибка" });
      router.refresh();
    });
  }

  return (
    <div className="rounded-card bg-surface p-5 shadow-soft ring-1 ring-line">
      <div className="mb-4 flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-soft text-brand-ink">
          <Webhook className="h-5 w-5" />
        </span>
        <div>
          <div className="text-sm font-semibold text-ink">Conversions API · покупки в Meta</div>
          <p className="text-xs text-muted">
            Покупки отправляются в датасет (Pixel) с привязкой к креативу — для похожих аудиторий.
          </p>
        </div>
      </div>

      {status ? (
        <>
          <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Field label="Датасет (Pixel)" value={status.datasetId} />
            <Field
              label="Статус"
              value={status.status === "error" ? "Ошибка" : "Подключено"}
              tone={status.status === "error" ? "err" : "ok"}
            />
            <Field
              label="Тестовый код"
              value={status.testEventCode || "не задан (боевой режим)"}
            />
            <Field
              label="Последнее событие"
              value={status.lastEventAt ? formatDateTime(status.lastEventAt) : "—"}
            />
          </div>

          {status.lastError && (
            <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              Последняя ошибка: {status.lastError}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={test}
              disabled={pending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-strong disabled:opacity-60"
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Отправить тестовое событие
            </button>
            <button
              type="button"
              onClick={disconnect}
              disabled={pending}
              className="inline-flex items-center gap-1.5 rounded-lg border border-line px-4 py-2 text-sm font-medium text-muted transition hover:bg-canvas hover:text-ink disabled:opacity-60"
            >
              <Unplug className="h-4 w-4" />
              Отключить
            </button>
          </div>
        </>
      ) : (
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs text-muted">ID датасета (Pixel)</label>
            <input
              value={datasetId}
              onChange={(e) => setDatasetId(e.target.value)}
              placeholder="напр. 962785768710642"
              className="w-full rounded-xl border border-line bg-canvas px-3.5 py-2.5 text-sm text-ink placeholder:text-faint focus:border-brand focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Токен доступа CAPI</label>
            <input
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="System User или токен из Events Manager"
              className="w-full rounded-xl border border-line bg-canvas px-3.5 py-2.5 text-sm text-ink placeholder:text-faint focus:border-brand focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">
              Тестовый код события (Test Event Code) — необязательно
            </label>
            <input
              value={testCode}
              onChange={(e) => setTestCode(e.target.value)}
              placeholder="TEST12345 — для проверки в Test Events (потом убрать)"
              className="w-full rounded-xl border border-line bg-canvas px-3.5 py-2.5 text-sm text-ink placeholder:text-faint focus:border-brand focus:outline-none"
            />
          </div>
          <button
            type="button"
            onClick={connect}
            disabled={pending}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-strong disabled:opacity-60"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plug className="h-4 w-4" />}
            Подключить
          </button>
        </div>
      )}

      {msg && (
        <p
          className={`mt-3 flex items-start gap-1.5 rounded-lg px-3 py-2 text-sm ${
            msg.kind === "ok" ? "bg-brand-soft text-brand-ink" : "bg-red-50 text-red-600"
          }`}
        >
          {msg.kind === "ok" && <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />}
          {msg.text}
        </p>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "ok" | "err";
}) {
  return (
    <div className="rounded-lg bg-canvas px-3 py-2">
      <div className="text-xs text-muted">{label}</div>
      <div
        className={`truncate text-sm font-medium ${
          tone === "err" ? "text-red-600" : tone === "ok" ? "text-brand-ink" : "text-ink"
        }`}
      >
        {value}
      </div>
    </div>
  );
}
