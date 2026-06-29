"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Loader2,
  Sparkles,
  Wand2,
  Megaphone,
  Calendar,
  Lightbulb,
  CheckCircle2,
  Film,
  Plus,
  Trash2,
} from "lucide-react";
import { SMM_FORMATS, SMM_RUBRICS, SMM_GOALS, type SmmIdea } from "@/lib/smm";
import { generateIdeasAction, addPost, updatePost, deletePost } from "@/app/p/[projectId]/smm/actions";

export interface SmmPost {
  id: string;
  title: string;
  format: string;
  rubric: string;
  goal: string;
  status: string;
}
export interface SmmStats {
  total: number;
  scheduled: number;
  published: number;
  ideas: number;
}

const STATUS_LABEL: Record<string, string> = { plan: "План", scheduled: "Запланировано", published: "Опубликовано" };

function StatCard({
  label,
  value,
  icon,
  tint,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  tint: string;
}) {
  return (
    <div className="rounded-card bg-surface p-5 shadow-soft ring-1 ring-line">
      <div className="flex items-start justify-between">
        <div className="text-sm text-muted">{label}</div>
        <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${tint}`}>{icon}</span>
      </div>
      <div className="mt-3 text-3xl font-bold text-ink">{value}</div>
    </div>
  );
}

const sel = "rounded-lg border border-line bg-canvas px-2 py-1.5 text-sm text-ink focus:border-brand focus:outline-none";

export function SmmStudio({
  projectId,
  connected,
  isOwner,
  stats,
  posts,
}: {
  projectId: string;
  connected: boolean;
  isOwner: boolean;
  stats: SmmStats;
  posts: SmmPost[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [format, setFormat] = useState(SMM_FORMATS[2]); // Reels
  const [theme, setTheme] = useState("");
  const [ideas, setIdeas] = useState<SmmIdea[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [genPending, startGen] = useTransition();

  function gen(themeOverride?: string) {
    setError(null);
    const t = themeOverride ?? theme;
    if (themeOverride !== undefined) setTheme(themeOverride);
    startGen(async () => {
      const r = await generateIdeasAction(projectId, format, t);
      if (!r.ok) {
        setError(r.error ?? "Ошибка");
        return;
      }
      setIdeas(r.ideas ?? []);
      router.refresh();
    });
  }

  function toPlan(idea: SmmIdea) {
    start(async () => {
      await addPost(projectId, { title: idea.title, format, rubric: idea.rubric, goal: idea.goal });
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      {/* Статы */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Постов в плане" value={stats.total} icon={<Calendar className="h-5 w-5 text-blue-600" />} tint="bg-blue-50" />
        <StatCard label="Запланировано" value={stats.scheduled} icon={<Lightbulb className="h-5 w-5 text-amber-500" />} tint="bg-amber-50" />
        <StatCard label="Опубликовано" value={stats.published} icon={<CheckCircle2 className="h-5 w-5 text-emerald-600" />} tint="bg-emerald-50" />
        <StatCard label="Идей сгенерировано" value={stats.ideas} icon={<Sparkles className="h-5 w-5 text-brand-ink" />} tint="bg-brand-soft" />
      </div>

      {/* Генератор идей */}
      <div className="rounded-card bg-surface p-6 shadow-soft ring-1 ring-line">
        <div className="mb-4 flex items-center gap-2">
          <Wand2 className="h-5 w-5 text-brand" />
          <div>
            <h2 className="text-base font-semibold text-ink">Генератор идей</h2>
            <p className="text-xs text-muted">Идеи для постов, stories и reels</p>
          </div>
        </div>

        {!connected ? (
          <div className="rounded-xl border border-dashed border-line bg-canvas px-4 py-6 text-center text-sm text-muted">
            Генерация идей работает на ключе DeepSeek.{" "}
            {isOwner ? (
              <Link href="/settings" className="font-medium text-brand-ink hover:underline">
                Подключить в «Настройках платформы»
              </Link>
            ) : (
              "Подключает владелец платформы."
            )}
          </div>
        ) : (
          <>
            <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-faint">Формат</div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {SMM_FORMATS.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFormat(f)}
                  className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition ${
                    format === f ? "border-brand bg-brand-soft text-brand-ink" : "border-line bg-canvas text-ink hover:bg-surface"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>

            <div className="mt-4">
              <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-faint">Тема (необязательно)</div>
              <input
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                placeholder="например, IELTS Speaking"
                className="w-full rounded-xl border border-line bg-canvas px-3.5 py-3 text-sm text-ink placeholder:text-faint focus:border-brand focus:outline-none"
              />
            </div>

            {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

            <button
              type="button"
              onClick={() => gen()}
              disabled={genPending}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-5 py-3.5 text-base font-semibold text-white transition hover:bg-brand-strong disabled:opacity-50"
            >
              {genPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
              {genPending ? "Генерирую…" : "Сгенерировать идеи"}
            </button>
          </>
        )}
      </div>

      {/* Идеи */}
      {connected && (
        <div>
          {ideas.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-card bg-surface px-6 py-12 text-center shadow-soft ring-1 ring-line">
              <Film className="h-10 w-10 text-faint" />
              <p className="mt-3 text-base font-semibold text-ink">Идеи появятся здесь</p>
              <p className="mt-1 text-sm text-muted">Выберите формат и нажмите «Сгенерировать идеи»</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {ideas.map((idea, i) => (
                <div key={i} className="rounded-card bg-surface p-4 shadow-soft ring-1 ring-line">
                  <div className="text-sm font-semibold text-ink">{idea.title}</div>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[11px] text-brand-ink">{idea.rubric}</span>
                    <span className="rounded-full bg-canvas px-2 py-0.5 text-[11px] text-muted ring-1 ring-line">{idea.goal}</span>
                  </div>
                  {idea.hook && <p className="mt-2 text-xs text-muted">{idea.hook}</p>}
                  <button
                    type="button"
                    onClick={() => toPlan(idea)}
                    disabled={pending}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-line bg-canvas px-2.5 py-1.5 text-xs font-medium text-ink transition hover:bg-surface disabled:opacity-50"
                  >
                    <Plus className="h-3.5 w-3.5" /> Добавить в план
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Прогревы и рубрики */}
      {connected && (
        <div className="rounded-card bg-surface p-6 shadow-soft ring-1 ring-line">
          <div className="mb-4 flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-brand" />
            <h2 className="text-base font-semibold text-ink">Прогревы и рубрики</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {SMM_RUBRICS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => gen(r)}
                disabled={genPending}
                className="inline-flex items-center gap-2 rounded-xl bg-canvas px-3.5 py-2 text-sm text-ink ring-1 ring-line transition hover:bg-surface disabled:opacity-50"
              >
                <span className="h-2 w-2 rounded-full bg-brand" />
                {r}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-faint">Нажми рубрику — сгенерирую идеи по ней для выбранного формата.</p>
        </div>
      )}

      {/* Контент-план */}
      <div className="rounded-card bg-surface shadow-soft ring-1 ring-line">
        <div className="flex flex-wrap items-center justify-between gap-3 p-5">
          <div>
            <h2 className="text-base font-semibold text-ink">Контент-план</h2>
            <p className="text-xs text-muted">Публикации и их статусы</p>
          </div>
          <button
            type="button"
            onClick={() => start(async () => { await addPost(projectId, { title: "Новый пост", format }); router.refresh(); })}
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-3.5 py-2 text-sm font-medium text-white transition hover:bg-brand-strong disabled:opacity-50"
          >
            <Plus className="h-4 w-4" /> Добавить пост
          </button>
        </div>

        {posts.length === 0 ? (
          <div className="border-t border-line px-6 py-10 text-center text-sm text-muted">
            Постов пока нет. Сгенерируйте идеи и добавьте в план — или «Добавить пост».
          </div>
        ) : (
          <div className="overflow-x-auto border-t border-line">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-faint">
                  <th className="px-5 py-3 font-medium">Тема</th>
                  <th className="px-4 py-3 font-medium">Формат</th>
                  <th className="px-4 py-3 font-medium">Рубрика</th>
                  <th className="px-4 py-3 font-medium">Цель</th>
                  <th className="px-4 py-3 font-medium">Статус</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {posts.map((p) => (
                  <tr key={p.id} className="border-b border-line last:border-0">
                    <td className="px-5 py-2.5">
                      <input
                        defaultValue={p.title}
                        onBlur={(e) => {
                          if (e.target.value !== p.title)
                            start(async () => { await updatePost(projectId, p.id, { title: e.target.value }); router.refresh(); });
                        }}
                        className="w-full min-w-[160px] rounded-lg border border-transparent bg-transparent px-2 py-1.5 text-sm text-ink hover:border-line focus:border-brand focus:bg-canvas focus:outline-none"
                      />
                    </td>
                    <td className="px-4 py-2.5">
                      <select
                        value={p.format}
                        onChange={(e) => start(async () => { await updatePost(projectId, p.id, { format: e.target.value }); router.refresh(); })}
                        className={sel}
                      >
                        <option value="">—</option>
                        {SMM_FORMATS.map((f) => <option key={f} value={f}>{f}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-2.5">
                      <select
                        value={p.rubric}
                        onChange={(e) => start(async () => { await updatePost(projectId, p.id, { rubric: e.target.value }); router.refresh(); })}
                        className={sel}
                      >
                        <option value="">—</option>
                        {SMM_RUBRICS.map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-2.5">
                      <select
                        value={p.goal}
                        onChange={(e) => start(async () => { await updatePost(projectId, p.id, { goal: e.target.value }); router.refresh(); })}
                        className={sel}
                      >
                        <option value="">—</option>
                        {SMM_GOALS.map((gl) => <option key={gl} value={gl}>{gl}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-2.5">
                      <select
                        value={p.status}
                        onChange={(e) => start(async () => { await updatePost(projectId, p.id, { status: e.target.value as "plan" | "scheduled" | "published" }); router.refresh(); })}
                        className={sel}
                      >
                        {(["plan", "scheduled", "published"] as const).map((s) => (
                          <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => start(async () => { await deletePost(projectId, p.id); router.refresh(); })}
                        className="rounded-lg border border-line p-1.5 text-muted transition hover:bg-red-50 hover:text-red-600"
                        title="Удалить"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
