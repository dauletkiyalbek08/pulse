"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles, Upload } from "lucide-react";
import { analyzeCall, createAudioUpload } from "@/app/p/[projectId]/calls/actions";
import { createClient as createBrowserSupabase } from "@/lib/supabase/client";
import { CallResultView } from "@/components/call-result-view";
import type { CallResult } from "@/lib/call-analysis";

export interface Employee {
  id: string;
  name: string;
  role: string;
}

const MAX_AUDIO = 25 * 1024 * 1024;

/** Форма разбора звонка: выбрать сотрудника, вставить текст или загрузить аудио → ИИ-оценка. */
export function CallAnalyzeForm({
  projectId,
  employees,
  asrConnected,
}: {
  projectId: string;
  employees: Employee[];
  asrConnected: boolean;
}) {
  const router = useRouter();
  const [employeeId, setEmployeeId] = useState(employees[0]?.id ?? "");
  const [transcript, setTranscript] = useState("");
  const [result, setResult] = useState<CallResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState<string | null>(null);
  // Если текст получен из аудио — для учёта расхода (минуты Whisper)
  const [audioSeconds, setAudioSeconds] = useState<number | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setUploadErr(null);
    if (f.size > MAX_AUDIO) {
      setUploadErr("Файл больше 25 МБ — разбейте запись на части");
      return;
    }
    setUploading(true);
    try {
      const ext = f.name.split(".").pop() ?? "m4a";
      const up = await createAudioUpload(projectId, ext);
      if (!up.ok || !up.path || !up.token) {
        setUploadErr(up.error ?? "Не удалось подготовить загрузку");
        return;
      }
      // Загрузка прямо в хранилище (минуя лимит тела запроса)
      const supa = createBrowserSupabase();
      const { error: upErr } = await supa.storage.from("call-audio").uploadToSignedUrl(up.path, up.token, f);
      if (upErr) {
        setUploadErr("Не удалось загрузить файл");
        return;
      }
      const res = await fetch("/api/calls/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, path: up.path }),
      });
      const json = (await res.json()) as { text?: string; seconds?: number; error?: string };
      if (!res.ok) {
        setUploadErr(json.error ?? "Ошибка распознавания");
      } else {
        setAudioSeconds(typeof json.seconds === "number" ? json.seconds : 0);
        setTranscript((prev) => (prev.trim() ? `${prev}\n${json.text ?? ""}` : json.text ?? ""));
      }
    } catch {
      setUploadErr("Не удалось обработать аудио");
    } finally {
      setUploading(false);
    }
  }

  function run() {
    setError(null);
    setResult(null);
    start(async () => {
      const opts =
        audioSeconds !== null
          ? { source: "audio" as const, audioSeconds }
          : { source: "text" as const };
      const r = await analyzeCall(projectId, employeeId, transcript, opts);
      if (!r.ok) {
        setError(r.error ?? "Ошибка анализа");
        return;
      }
      setResult(r.result ?? null);
      router.refresh();
    });
  }

  const tooShort = transcript.trim().length < 30;

  return (
    <div className="rounded-card bg-surface p-6 shadow-soft ring-1 ring-line">
      <h2 className="text-base font-semibold text-ink">Новый разбор звонка</h2>
      <p className="mt-0.5 text-xs text-muted">Текст можно вставлять на казахском или русском — ответ будет на русском.</p>

      <div className="mt-4 grid gap-3 sm:grid-cols-[240px_1fr]">
        <div>
          <label className="text-xs font-medium text-muted">Сотрудник</label>
          <select
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
            className="mt-1 w-full rounded-xl border border-line bg-canvas px-3 py-2.5 text-sm text-ink focus:border-brand focus:outline-none"
          >
            {employees.length === 0 && <option value="">Нет сотрудников</option>}
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name} — {e.role === "hunter" ? "хантер" : "менеджер"}
              </option>
            ))}
          </select>
        </div>
        <div>
          <div className="flex items-center justify-between gap-2">
            <label className="text-xs font-medium text-muted">Текст разговора</label>
            {asrConnected && (
              <>
                <input ref={fileRef} type="file" accept="audio/*" onChange={onFile} className="hidden" />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-canvas px-2.5 py-1 text-xs text-ink transition hover:bg-surface disabled:opacity-50"
                >
                  {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                  {uploading ? "Распознаю…" : "Загрузить аудио"}
                </button>
              </>
            )}
          </div>
          <textarea
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            rows={6}
            placeholder="Вставьте расшифровку звонка или загрузите аудио…"
            className="mt-1 w-full rounded-xl border border-line bg-canvas px-3 py-2.5 text-sm text-ink placeholder:text-faint focus:border-brand focus:outline-none"
          />
          {uploadErr && <p className="mt-1 text-xs text-red-600">{uploadErr}</p>}
        </div>
      </div>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      <div className="mt-4">
        <button
          type="button"
          onClick={run}
          disabled={pending || !employeeId || tooShort}
          className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-strong disabled:opacity-50"
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {pending ? "Анализирую…" : "Анализировать"}
        </button>
      </div>

      {result && (
        <div className="mt-6 border-t border-line pt-6">
          <CallResultView result={result} />
        </div>
      )}
    </div>
  );
}
