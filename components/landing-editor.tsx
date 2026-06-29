"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Copy, ExternalLink, Trash2, Check, ListChecks } from "lucide-react";
import {
  createLanding,
  createQuiz,
  updateLanding,
  deleteLanding,
} from "@/app/p/[projectId]/resources/actions";
import type { QuizQuestion } from "@/lib/quiz-sample";

export interface Landing {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  bullets: string[];
  button_text: string;
  thanks_text: string;
  accent: string;
  pixel_id: string | null;
  status: string;
  type: string;
  questions: QuizQuestion[];
  logo: string | null;
  socials: { instagram?: string; telegram?: string; tiktok?: string };
  start_button: string;
}

export function CreateLandingButton({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      onClick={() => start(async () => { await createLanding(projectId); router.refresh(); })}
      disabled={pending}
      className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-strong disabled:opacity-50"
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
      Создать лендинг
    </button>
  );
}

export function CreateQuizButton({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      onClick={() => start(async () => { await createQuiz(projectId); router.refresh(); })}
      disabled={pending}
      className="inline-flex items-center gap-2 rounded-xl border border-line bg-canvas px-4 py-2.5 text-sm font-medium text-ink transition hover:bg-surface disabled:opacity-50"
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ListChecks className="h-4 w-4 text-brand" />}
      Создать квиз
    </button>
  );
}

const inputCls =
  "mt-1 w-full rounded-xl border border-line bg-canvas px-3 py-2.5 text-sm text-ink placeholder:text-faint focus:border-brand focus:outline-none";

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div>
      <label className="text-xs font-medium text-muted">{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-faint">{hint}</p>}
    </div>
  );
}

interface QEdit {
  q: string;
  options: string; // по строке
}

export function LandingEditor({ projectId, landing }: { projectId: string; landing: Landing }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const isQuiz = landing.type === "quiz";

  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  const [title, setTitle] = useState(landing.title);
  const [subtitle, setSubtitle] = useState(landing.subtitle);
  const [bullets, setBullets] = useState(landing.bullets.join("\n"));
  const [buttonText, setButtonText] = useState(landing.button_text);
  const [thanksText, setThanksText] = useState(landing.thanks_text);
  const [accent, setAccent] = useState(landing.accent);
  const [pixelId, setPixelId] = useState(landing.pixel_id ?? "");
  const [slug, setSlug] = useState(landing.slug);
  const [status, setStatus] = useState<"active" | "draft">(landing.status === "draft" ? "draft" : "active");

  // Квиз
  const [logo, setLogo] = useState(landing.logo ?? "");
  const [startButton, setStartButton] = useState(landing.start_button || "Бастау");
  const [ig, setIg] = useState(landing.socials?.instagram ?? "");
  const [tg, setTg] = useState(landing.socials?.telegram ?? "");
  const [tt, setTt] = useState(landing.socials?.tiktok ?? "");
  const [questions, setQuestions] = useState<QEdit[]>(
    landing.questions.map((q) => ({ q: q.q, options: q.options.join("\n") })),
  );

  const publicPath = `/l/${slug}`;
  const fullUrl = () => (typeof window !== "undefined" ? `${window.location.origin}${publicPath}` : publicPath);

  function setQ(i: number, patch: Partial<QEdit>) {
    setQuestions((arr) => arr.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  }

  function save() {
    setError(null);
    setSaved(false);
    start(async () => {
      const r = await updateLanding(projectId, landing.id, {
        title,
        subtitle,
        bullets: isQuiz ? [] : bullets.split("\n"),
        button_text: buttonText,
        thanks_text: thanksText,
        accent,
        pixel_id: pixelId,
        slug,
        status,
        type: isQuiz ? "quiz" : "simple",
        questions: isQuiz
          ? questions.map((x) => ({ q: x.q.trim(), options: x.options.split("\n").map((s) => s.trim()).filter(Boolean) }))
          : [],
        logo: isQuiz ? logo : "",
        socials: isQuiz ? { instagram: ig || undefined, telegram: tg || undefined, tiktok: tt || undefined } : {},
        startButton: isQuiz ? startButton : "Бастау",
      });
      if (!r.ok) {
        setError(r.error ?? "Ошибка");
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  function remove() {
    if (!confirm("Удалить? Ссылка перестанет работать.")) return;
    start(async () => { await deleteLanding(projectId, landing.id); router.refresh(); });
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(fullUrl());
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* буфер недоступен */
    }
  }

  return (
    <div className="rounded-card bg-surface shadow-soft ring-1 ring-line">
      <div className="flex flex-wrap items-center gap-3 p-5">
        <span className="h-9 w-9 shrink-0 rounded-xl" style={{ backgroundColor: landing.accent }} aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-semibold text-ink">{landing.title}</span>
            {isQuiz && <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[11px] text-brand-ink">квиз</span>}
            {landing.status === "draft" && (
              <span className="rounded-full bg-canvas px-2 py-0.5 text-[11px] text-muted ring-1 ring-line">черновик</span>
            )}
          </div>
          <code className="text-xs text-muted">{publicPath}</code>
        </div>
        <button type="button" onClick={copy} className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-canvas px-2.5 py-1.5 text-xs text-ink transition hover:bg-surface">
          {copied ? <Check className="h-3.5 w-3.5 text-brand" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Скопировано" : "Копировать ссылку"}
        </button>
        <a href={publicPath} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-canvas px-2.5 py-1.5 text-xs text-ink transition hover:bg-surface">
          <ExternalLink className="h-3.5 w-3.5" /> Открыть
        </a>
        <button type="button" onClick={() => setOpen((v) => !v)} className="rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-white transition hover:bg-brand-strong">
          {open ? "Свернуть" : "Редактировать"}
        </button>
      </div>

      {open && (
        <div className="space-y-4 border-t border-line p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={isQuiz ? "Заголовок (стартовый экран)" : "Заголовок"}>
              <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Подзаголовок / оффер">
              <input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} className={inputCls} />
            </Field>
          </div>

          {isQuiz ? (
            <>
              <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
                <Field label="Логотип (текст вверху)">
                  <input value={logo} onChange={(e) => setLogo(e.target.value)} className={inputCls} />
                </Field>
                <Field label="Кнопка старта">
                  <input value={startButton} onChange={(e) => setStartButton(e.target.value)} className={inputCls} />
                </Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Instagram (ссылка)"><input value={ig} onChange={(e) => setIg(e.target.value)} placeholder="https://instagram.com/…" className={inputCls} /></Field>
                <Field label="Telegram (ссылка)"><input value={tg} onChange={(e) => setTg(e.target.value)} placeholder="https://t.me/…" className={inputCls} /></Field>
                <Field label="TikTok (ссылка)"><input value={tt} onChange={(e) => setTt(e.target.value)} placeholder="https://tiktok.com/@…" className={inputCls} /></Field>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-xs font-medium text-muted">Вопросы</label>
                  <button
                    type="button"
                    onClick={() => setQuestions((a) => [...a, { q: "", options: "" }])}
                    className="inline-flex items-center gap-1 rounded-lg border border-line bg-canvas px-2.5 py-1 text-xs text-ink transition hover:bg-surface"
                  >
                    <Plus className="h-3.5 w-3.5" /> Вопрос
                  </button>
                </div>
                <div className="space-y-3">
                  {questions.map((qq, qi) => (
                    <div key={qi} className="rounded-xl bg-canvas p-3 ring-1 ring-line">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-muted">Вопрос {qi + 1}</span>
                        <button
                          type="button"
                          onClick={() => setQuestions((a) => a.filter((_, idx) => idx !== qi))}
                          className="ml-auto text-xs text-muted transition hover:text-red-600"
                        >
                          Удалить
                        </button>
                      </div>
                      <input
                        value={qq.q}
                        onChange={(e) => setQ(qi, { q: e.target.value })}
                        placeholder="Текст вопроса"
                        className="mt-2 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none"
                      />
                      <textarea
                        value={qq.options}
                        onChange={(e) => setQ(qi, { options: e.target.value })}
                        rows={3}
                        placeholder="Варианты ответа — по одному в строке"
                        className="mt-2 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <Field label="Преимущества (по одному в строке)">
              <textarea value={bullets} onChange={(e) => setBullets(e.target.value)} rows={4} className={inputCls} />
            </Field>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={isQuiz ? "Кнопка отправки (финал)" : "Текст кнопки"}>
              <input value={buttonText} onChange={(e) => setButtonText(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Текст после отправки">
              <input value={thanksText} onChange={(e) => setThanksText(e.target.value)} className={inputCls} />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Ссылка (slug)" hint="латиница, цифры, дефис">
              <input value={slug} onChange={(e) => setSlug(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Pixel ID (Meta)" hint="из раздела CAPI — для статистики и CAPI">
              <input value={pixelId} onChange={(e) => setPixelId(e.target.value)} placeholder="необязательно" className={inputCls} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Цвет">
                <input type="color" value={accent} onChange={(e) => setAccent(e.target.value)} className="mt-1 h-[42px] w-full cursor-pointer rounded-xl border border-line bg-canvas px-1" />
              </Field>
              <Field label="Статус">
                <select value={status} onChange={(e) => setStatus(e.target.value === "draft" ? "draft" : "active")} className={inputCls}>
                  <option value="active">Активен</option>
                  <option value="draft">Черновик</option>
                </select>
              </Field>
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button type="button" onClick={save} disabled={pending} className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-strong disabled:opacity-50">
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Сохранить
            </button>
            {saved && <span className="text-sm text-brand-ink">Сохранено</span>}
            <button type="button" onClick={remove} disabled={pending} className="ml-auto inline-flex items-center gap-1.5 rounded-xl border border-line px-3 py-2 text-sm text-muted transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50">
              <Trash2 className="h-4 w-4" /> Удалить
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
