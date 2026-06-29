"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Copy, ExternalLink, Trash2, Check } from "lucide-react";
import { createLanding, updateLanding, deleteLanding } from "@/app/p/[projectId]/resources/actions";

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
}

export function CreateLandingButton({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      onClick={() =>
        start(async () => {
          await createLanding(projectId);
          router.refresh();
        })
      }
      disabled={pending}
      className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-strong disabled:opacity-50"
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
      Создать лендинг
    </button>
  );
}

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-muted">{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-faint">{hint}</p>}
    </div>
  );
}

const inputCls =
  "mt-1 w-full rounded-xl border border-line bg-canvas px-3 py-2.5 text-sm text-ink placeholder:text-faint focus:border-brand focus:outline-none";

export function LandingEditor({ projectId, landing }: { projectId: string; landing: Landing }) {
  const router = useRouter();
  const [pending, start] = useTransition();
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

  const publicPath = `/l/${slug}`;
  const fullUrl = () => (typeof window !== "undefined" ? `${window.location.origin}${publicPath}` : publicPath);

  function save() {
    setError(null);
    setSaved(false);
    start(async () => {
      const r = await updateLanding(projectId, landing.id, {
        title,
        subtitle,
        bullets: bullets.split("\n"),
        button_text: buttonText,
        thanks_text: thanksText,
        accent,
        pixel_id: pixelId,
        slug,
        status,
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
    if (!confirm("Удалить лендинг? Ссылка перестанет работать.")) return;
    start(async () => {
      await deleteLanding(projectId, landing.id);
      router.refresh();
    });
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(fullUrl());
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // буфер недоступен — пользователь скопирует вручную
    }
  }

  return (
    <div className="rounded-card bg-surface shadow-soft ring-1 ring-line">
      <div className="flex flex-wrap items-center gap-3 p-5">
        <span
          className="h-9 w-9 shrink-0 rounded-xl"
          style={{ backgroundColor: landing.accent }}
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-semibold text-ink">{landing.title}</span>
            {landing.status === "draft" && (
              <span className="rounded-full bg-canvas px-2 py-0.5 text-[11px] text-muted ring-1 ring-line">
                черновик
              </span>
            )}
          </div>
          <code className="text-xs text-muted">{publicPath}</code>
        </div>
        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-canvas px-2.5 py-1.5 text-xs text-ink transition hover:bg-surface"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-brand" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Скопировано" : "Копировать ссылку"}
        </button>
        <a
          href={publicPath}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-canvas px-2.5 py-1.5 text-xs text-ink transition hover:bg-surface"
        >
          <ExternalLink className="h-3.5 w-3.5" /> Открыть
        </a>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-white transition hover:bg-brand-strong"
        >
          {open ? "Свернуть" : "Редактировать"}
        </button>
      </div>

      {open && (
        <div className="space-y-4 border-t border-line p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Заголовок">
              <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Подзаголовок">
              <input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} className={inputCls} />
            </Field>
          </div>

          <Field label="Преимущества (по одному в строке)">
            <textarea value={bullets} onChange={(e) => setBullets(e.target.value)} rows={4} className={inputCls} />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Текст кнопки">
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
                <input
                  type="color"
                  value={accent}
                  onChange={(e) => setAccent(e.target.value)}
                  className="mt-1 h-[42px] w-full cursor-pointer rounded-xl border border-line bg-canvas px-1"
                />
              </Field>
              <Field label="Статус">
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value === "draft" ? "draft" : "active")}
                  className={inputCls}
                >
                  <option value="active">Активен</option>
                  <option value="draft">Черновик</option>
                </select>
              </Field>
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="button"
              onClick={save}
              disabled={pending}
              className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-strong disabled:opacity-50"
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Сохранить
            </button>
            {saved && <span className="text-sm text-brand-ink">Сохранено</span>}
            <button
              type="button"
              onClick={remove}
              disabled={pending}
              className="ml-auto inline-flex items-center gap-1.5 rounded-xl border border-line px-3 py-2 text-sm text-muted transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" /> Удалить
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
