"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Loader2,
  Sparkles,
  Megaphone,
  Video,
  Film,
  ListChecks,
  MessagesSquare,
  Copy,
  Check,
  Trash2,
  Settings2,
  Clapperboard,
} from "lucide-react";
import { TOOLS, type AiTool } from "@/lib/ai-studio";
import { generate, deleteGeneration } from "@/app/p/[projectId]/ai/actions";
import { formatDateTime } from "@/lib/format";

const ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  megaphone: Megaphone,
  video: Video,
  film: Film,
  list: ListChecks,
  messages: MessagesSquare,
  sparkles: Sparkles,
};

export interface GenerationRow {
  id: string;
  tool: string;
  title: string;
  output: string;
  created_at: string;
}

function CopyBtn({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {
          /* буфер недоступен */
        }
      }}
      className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-canvas px-2.5 py-1.5 text-xs text-ink transition hover:bg-surface"
    >
      {done ? <Check className="h-3.5 w-3.5 text-brand" /> : <Copy className="h-3.5 w-3.5" />}
      {done ? "Скопировано" : "Копировать"}
    </button>
  );
}

export function AiStudio({
  projectId,
  connected,
  isOwner,
  recent,
}: {
  projectId: string;
  connected: boolean;
  isOwner: boolean;
  recent: GenerationRow[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [tool, setTool] = useState<AiTool | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [output, setOutput] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function choose(t: AiTool) {
    setTool(t);
    setOutput(null);
    setError(null);
    const init: Record<string, string> = {};
    for (const f of t.fields) init[f.name] = f.type === "select" ? f.options?.[0] ?? "" : "";
    setValues(init);
  }

  function run() {
    if (!tool) return;
    setError(null);
    setOutput(null);
    start(async () => {
      const r = await generate(projectId, tool.key, values);
      if (!r.ok) {
        setError(r.error ?? "Ошибка");
        return;
      }
      setOutput(r.output ?? "");
      router.refresh();
    });
  }

  if (!connected) {
    return (
      <div className="rounded-card border border-dashed border-line bg-surface px-6 py-10 text-center">
        <Sparkles className="mx-auto h-8 w-8 text-brand" />
        <p className="mt-3 text-sm font-medium text-ink">AI Studio работает на ключе DeepSeek</p>
        {isOwner ? (
          <>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted">
              Добавьте ключ DeepSeek в «Настройках платформы» — он один на все проекты.
            </p>
            <Link href="/settings" className="mt-4 inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-strong">
              <Settings2 className="h-4 w-4" /> Открыть настройки платформы
            </Link>
          </>
        ) : (
          <p className="mx-auto mt-1 max-w-md text-sm text-muted">Подключение настраивает владелец платформы.</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Видео/фото-креативы — подключение по проекту (скоро) */}
      <div className="flex flex-wrap items-center gap-3 rounded-card border border-brand-soft bg-brand-soft/40 p-4">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand-ink">
          <Clapperboard className="h-5 w-5" />
        </span>
        <p className="min-w-0 flex-1 text-sm text-ink">
          <span className="font-medium">Генерация видео- и фото-креативов</span> (Higgsfield и др.) подключается
          <span className="font-medium"> по проекту</span> — отдельной подпиской на видео-ИИ. Добавим сюда, когда у
          проекта будет доступ. Уже сейчас работает <span className="font-medium">«Видео-сценарий (одно лицо)»</span> —
          DeepSeek собирает сценарий и связанные промты с одним лицом для вашего видео-ИИ.
        </p>
      </div>

      {/* Выбор инструмента */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {TOOLS.map((t) => {
          const Icon = ICON[t.icon] ?? Sparkles;
          const active = tool?.key === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => choose(t)}
              className={`rounded-card p-4 text-left ring-1 transition ${
                active ? "bg-brand-soft ring-brand" : "bg-surface shadow-soft ring-line hover:bg-canvas"
              }`}
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-soft text-brand-ink">
                <Icon className="h-5 w-5" />
              </span>
              <div className="mt-2.5 text-sm font-semibold text-ink">{t.title}</div>
              <div className="mt-0.5 text-xs text-muted">{t.description}</div>
            </button>
          );
        })}
      </div>

      {/* Форма */}
      {tool && (
        <div className="rounded-card bg-surface p-6 shadow-soft ring-1 ring-line">
          <h2 className="text-base font-semibold text-ink">{tool.title}</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {tool.fields.map((f) => (
              <div key={f.name} className={f.type === "textarea" ? "sm:col-span-2" : ""}>
                <label className="text-xs font-medium text-muted">{f.label}</label>
                {f.type === "select" ? (
                  <select
                    value={values[f.name] ?? ""}
                    onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
                    className="mt-1 w-full rounded-xl border border-line bg-canvas px-3 py-2.5 text-sm text-ink focus:border-brand focus:outline-none"
                  >
                    {(f.options ?? []).map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                ) : f.type === "textarea" ? (
                  <textarea
                    value={values[f.name] ?? ""}
                    onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
                    rows={3}
                    placeholder={f.placeholder}
                    className="mt-1 w-full rounded-xl border border-line bg-canvas px-3 py-2.5 text-sm text-ink placeholder:text-faint focus:border-brand focus:outline-none"
                  />
                ) : (
                  <input
                    value={values[f.name] ?? ""}
                    onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
                    placeholder={f.placeholder}
                    className="mt-1 w-full rounded-xl border border-line bg-canvas px-3 py-2.5 text-sm text-ink placeholder:text-faint focus:border-brand focus:outline-none"
                  />
                )}
              </div>
            ))}
          </div>

          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

          <button
            type="button"
            onClick={run}
            disabled={pending}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-strong disabled:opacity-50"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {pending ? "Генерирую…" : "Сгенерировать"}
          </button>

          {output && (
            <div className="mt-5 border-t border-line pt-5">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-faint">Результат</span>
                <CopyBtn text={output} />
              </div>
              <pre className="whitespace-pre-wrap rounded-xl bg-canvas p-4 text-sm leading-relaxed text-ink ring-1 ring-line">
                {output}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* История */}
      {recent.length > 0 && (
        <div>
          <h2 className="mb-3 text-base font-semibold text-ink">История</h2>
          <div className="space-y-2.5">
            {recent.map((r) => (
              <details key={r.id} className="rounded-card bg-surface shadow-soft ring-1 ring-line">
                <summary className="flex cursor-pointer list-none items-center gap-3 p-4">
                  <Sparkles className="h-4 w-4 shrink-0 text-brand" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-ink">{r.title}</div>
                    <div className="text-xs text-muted">{formatDateTime(r.created_at)}</div>
                  </div>
                </summary>
                <div className="space-y-3 border-t border-line p-4">
                  <pre className="whitespace-pre-wrap rounded-xl bg-canvas p-4 text-sm leading-relaxed text-ink ring-1 ring-line">
                    {r.output}
                  </pre>
                  <div className="flex items-center gap-2">
                    <CopyBtn text={r.output} />
                    <button
                      type="button"
                      onClick={() =>
                        start(async () => {
                          await deleteGeneration(projectId, r.id);
                          router.refresh();
                        })
                      }
                      className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-xs text-muted transition hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Удалить
                    </button>
                  </div>
                </div>
              </details>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
