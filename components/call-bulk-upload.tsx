"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, UploadCloud, CheckCircle2, AlertCircle } from "lucide-react";
import { analyzeCall, createAudioUpload } from "@/app/p/[projectId]/calls/actions";
import { createClient as createBrowserSupabase } from "@/lib/supabase/client";
import type { Employee } from "@/components/call-analyze-form";

const MAX_AUDIO = 25 * 1024 * 1024;

type ItemStatus = "queued" | "working" | "done" | "error";
interface Item {
  name: string;
  status: ItemStatus;
  msg?: string;
  score?: number;
}

function tone(score: number): string {
  if (score >= 80) return "bg-emerald-100 text-emerald-700";
  if (score >= 60) return "bg-amber-100 text-amber-700";
  return "bg-red-100 text-red-700";
}

/** Массовая загрузка записей: несколько файлов → распознавание + авто-анализ для выбранного сотрудника. */
export function CallBulkUpload({
  projectId,
  employees,
  asrConnected,
}: {
  projectId: string;
  employees: Employee[];
  asrConnected: boolean;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [employeeId, setEmployeeId] = useState(employees[0]?.id ?? "");
  const [items, setItems] = useState<Item[]>([]);
  const [running, setRunning] = useState(false);

  async function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!files.length || !employeeId) return;

    setRunning(true);
    setItems(files.map((f) => ({ name: f.name, status: "queued" as const })));
    const supa = createBrowserSupabase();

    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const patch = (p: Partial<Item>) =>
        setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...p } : it)));

      if (f.size > MAX_AUDIO) {
        patch({ status: "error", msg: "больше 25 МБ" });
        continue;
      }
      patch({ status: "working", msg: "загрузка…" });
      try {
        const ext = f.name.split(".").pop() ?? "m4a";
        const up = await createAudioUpload(projectId, ext);
        if (!up.ok || !up.path || !up.token) {
          patch({ status: "error", msg: up.error ?? "ошибка загрузки" });
          continue;
        }
        const { error: upErr } = await supa.storage.from("call-audio").uploadToSignedUrl(up.path, up.token, f);
        if (upErr) {
          patch({ status: "error", msg: "ошибка загрузки" });
          continue;
        }
        patch({ msg: "распознаю…" });
        const res = await fetch("/api/calls/transcribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId, path: up.path }),
        });
        const tj = (await res.json()) as { text?: string; seconds?: number; error?: string };
        if (!res.ok) {
          patch({ status: "error", msg: tj.error ?? "ошибка распознавания" });
          continue;
        }
        const text = (tj.text ?? "").trim();
        if (text.length < 30) {
          patch({ status: "error", msg: "слишком короткая запись" });
          continue;
        }
        patch({ msg: "анализ…" });
        const r = await analyzeCall(projectId, employeeId, text, {
          source: "audio",
          audioSeconds: tj.seconds ?? 0,
        });
        if (!r.ok) {
          patch({ status: "error", msg: r.error ?? "ошибка анализа" });
          continue;
        }
        patch({ status: "done", score: r.result?.overall ?? 0, msg: undefined });
      } catch {
        patch({ status: "error", msg: "сбой" });
      }
    }

    setRunning(false);
    router.refresh();
  }

  if (!asrConnected) {
    return (
      <div className="rounded-card border border-dashed border-line bg-surface px-5 py-6 text-sm text-muted">
        Чтобы загружать записи пачкой, подключите распознавание речи (ключ OpenAI) в «Настройках платформы».
      </div>
    );
  }

  const done = items.filter((i) => i.status === "done").length;

  return (
    <div className="rounded-card bg-surface p-6 shadow-soft ring-1 ring-line">
      <h2 className="text-base font-semibold text-ink">Массовая загрузка записей</h2>
      <p className="mt-0.5 text-xs text-muted">
        Выберите сотрудника и несколько аудиозаписей — каждая распознается и оценится автоматически.
      </p>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div className="min-w-[220px]">
          <label className="text-xs font-medium text-muted">Сотрудник</label>
          <select
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
            disabled={running}
            className="mt-1 w-full rounded-xl border border-line bg-canvas px-3 py-2.5 text-sm text-ink focus:border-brand focus:outline-none disabled:opacity-60"
          >
            {employees.length === 0 && <option value="">Нет сотрудников</option>}
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name} — {e.role === "hunter" ? "хантер" : "менеджер"}
              </option>
            ))}
          </select>
        </div>
        <input ref={fileRef} type="file" accept="audio/*" multiple onChange={onFiles} className="hidden" />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={running || !employeeId}
          className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-strong disabled:opacity-50"
        >
          {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
          {running ? "Обрабатываю…" : "Выбрать записи"}
        </button>
        {items.length > 0 && (
          <span className="text-xs text-muted">
            готово {done} из {items.length}
          </span>
        )}
      </div>

      {items.length > 0 && (
        <div className="mt-4 space-y-1.5">
          {items.map((it, idx) => (
            <div
              key={`${it.name}-${idx}`}
              className="flex items-center gap-2 rounded-lg bg-canvas px-3 py-2 text-sm ring-1 ring-line"
            >
              {it.status === "done" ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
              ) : it.status === "error" ? (
                <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
              ) : it.status === "working" ? (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted" />
              ) : (
                <span className="h-4 w-4 shrink-0 rounded-full border border-line" />
              )}
              <span className="min-w-0 flex-1 truncate text-ink">{it.name}</span>
              {it.status === "done" && it.score !== undefined ? (
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${tone(it.score)}`}>
                  {it.score}/100
                </span>
              ) : (
                <span className={`text-xs ${it.status === "error" ? "text-red-600" : "text-muted"}`}>
                  {it.msg ?? (it.status === "queued" ? "в очереди" : "")}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
