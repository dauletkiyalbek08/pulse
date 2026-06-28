"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles } from "lucide-react";
import { analyzeCall } from "@/app/p/[projectId]/calls/actions";
import { CallResultView } from "@/components/call-result-view";
import type { CallResult } from "@/lib/call-analysis";

export interface Employee {
  id: string;
  name: string;
  role: string;
}

/** Форма разбора звонка: выбрать сотрудника, вставить текст → ИИ-оценка. */
export function CallAnalyzeForm({ projectId, employees }: { projectId: string; employees: Employee[] }) {
  const router = useRouter();
  const [employeeId, setEmployeeId] = useState(employees[0]?.id ?? "");
  const [transcript, setTranscript] = useState("");
  const [result, setResult] = useState<CallResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function run() {
    setError(null);
    setResult(null);
    start(async () => {
      const r = await analyzeCall(projectId, employeeId, transcript);
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
          <label className="text-xs font-medium text-muted">Текст разговора</label>
          <textarea
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            rows={6}
            placeholder="Вставьте расшифровку звонка…"
            className="mt-1 w-full rounded-xl border border-line bg-canvas px-3 py-2.5 text-sm text-ink placeholder:text-faint focus:border-brand focus:outline-none"
          />
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
