"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Loader2,
  Sparkles,
  Wand2,
  Film,
  Image as ImageIcon,
  Copy,
  Check,
  Trash2,
  Settings2,
  User,
} from "lucide-react";
import { generate, deleteGeneration } from "@/app/p/[projectId]/ai/actions";
import { formatDateTime } from "@/lib/format";

export interface GenerationRow {
  id: string;
  tool: string;
  title: string;
  output: string;
  created_at: string;
}

const VIDEO_FORMATS = ["Reels", "TikTok", "Stories", "YouTube Shorts"];
const DURATIONS = ["15 сек", "30 сек", "60 сек"];
const COUNTS = ["1", "2", "3", "4", "5", "6"];
const STYLES = [
  "Динамичный / трендовый",
  "Спокойный / экспертный",
  "Эмоциональный / история",
  "Премиум / минимализм",
];
const PHOTO_RATIOS = ["Квадрат 1:1", "Вертикаль 4:5", "Сторис 9:16"];
const PHOTO_TYPES = ["Баннер для таргета", "Продуктовое фото", "Промо с персонажем", "Акция / скидка"];
const LANGS = ["Русский", "Казахский"];

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

/** Сегментированный выбор (как на макете). */
function Seg({
  value,
  options,
  onChange,
  cols = 2,
  labelFn,
}: {
  value: string;
  options: string[];
  onChange: (v: string) => void;
  cols?: number;
  labelFn?: (v: string) => string;
}) {
  return (
    <div className={`grid gap-2 ${cols === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
      {options.map((o) => {
        const active = value === o;
        return (
          <button
            key={o}
            type="button"
            onClick={() => onChange(o)}
            className={`rounded-xl border px-3 py-3 text-sm font-medium transition ${
              active ? "border-brand bg-brand-soft text-brand-ink" : "border-line bg-canvas text-ink hover:bg-surface"
            }`}
          >
            {labelFn ? labelFn(o) : o}
          </button>
        );
      })}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-faint">{children}</div>;
}

const inputCls =
  "w-full rounded-xl border border-line bg-canvas px-3.5 py-3 text-sm text-ink placeholder:text-faint focus:border-brand focus:outline-none";

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
  const [tab, setTab] = useState<"video" | "photo">("video");
  const [output, setOutput] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Видео
  const [format, setFormat] = useState(VIDEO_FORMATS[0]);
  const [duration, setDuration] = useState(DURATIONS[1]);
  const [count, setCount] = useState("4");
  const [oneChar, setOneChar] = useState(true);
  const [style, setStyle] = useState(STYLES[0]);
  const [topic, setTopic] = useState("");
  const [character, setCharacter] = useState("");
  const [cta, setCta] = useState("");
  const [lang, setLang] = useState(LANGS[0]);

  // Фото
  const [ratio, setRatio] = useState(PHOTO_RATIOS[0]);
  const [ptype, setPtype] = useState(PHOTO_TYPES[0]);
  const [offer, setOffer] = useState("");
  const [subject, setSubject] = useState("");

  function run() {
    setError(null);
    setOutput(null);
    const toolKey = tab === "video" ? "video_series" : "photo_creative";
    const values: Record<string, string> =
      tab === "video"
        ? { topic, character, format, duration, count, style, cta, onechar: oneChar ? "да" : "нет", lang }
        : { ratio, type: ptype, offer, subject, lang };
    start(async () => {
      const r = await generate(projectId, toolKey, values);
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
      {/* Демо-режим */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold text-brand-ink">
          <Sparkles className="h-3.5 w-3.5" /> Beta · демо-режим
        </span>
        <span className="text-xs text-muted">
          Сейчас собираем сценарий и промты. Генерация видео/фото (Higgsfield и др.) подключается по проекту — позже.
        </span>
      </div>

      {/* Вкладки Видео / Фото */}
      <div className="inline-flex rounded-xl border border-line bg-canvas p-0.5">
        {(["video", "photo"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => {
              setTab(t);
              setOutput(null);
              setError(null);
            }}
            className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm transition ${
              tab === t ? "bg-surface font-medium text-ink shadow-soft" : "text-muted hover:text-ink"
            }`}
          >
            {t === "video" ? <Film className="h-4 w-4" /> : <ImageIcon className="h-4 w-4" />}
            {t === "video" ? "Видео" : "Фото"}
          </button>
        ))}
      </div>

      <div className="rounded-card bg-surface p-6 shadow-soft ring-1 ring-line">
        <div className="mb-5 flex items-center gap-2">
          <Wand2 className="h-5 w-5 text-brand" />
          <div>
            <h2 className="text-base font-semibold text-ink">Параметры генерации</h2>
            <p className="text-xs text-muted">
              {tab === "video" ? "Настройте серию из связанных роликов" : "Настройте баннер для таргета"}
            </p>
          </div>
        </div>

        {tab === "video" ? (
          <div className="space-y-5">
            <div>
              <Label>Формат</Label>
              <Seg value={format} options={VIDEO_FORMATS} onChange={setFormat} cols={2} />
            </div>
            <div>
              <Label>Длительность</Label>
              <Seg value={duration} options={DURATIONS} onChange={setDuration} cols={3} />
            </div>
            <div>
              <Label>Количество связанных видео</Label>
              <select value={count} onChange={(e) => setCount(e.target.value)} className={inputCls}>
                {COUNTS.map((c) => (
                  <option key={c} value={c}>
                    {c} видео
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={() => setOneChar((v) => !v)}
              className="flex w-full items-center gap-3 rounded-xl border border-line bg-canvas px-4 py-3 text-left transition hover:bg-surface"
            >
              <User className="h-5 w-5 text-muted" />
              <div className="flex-1">
                <div className="text-sm font-medium text-ink">Один персонаж во всех видео</div>
                <div className="text-xs text-muted">Сохранять героя между роликами</div>
              </div>
              <span className={`relative h-6 w-11 shrink-0 rounded-full transition ${oneChar ? "bg-brand" : "bg-line"}`}>
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                    oneChar ? "left-[22px]" : "left-0.5"
                  }`}
                />
              </span>
            </button>

            {oneChar && (
              <div>
                <Label>Персонаж (лицо)</Label>
                <input
                  value={character}
                  onChange={(e) => setCharacter(e.target.value)}
                  placeholder="Девушка 25 лет, тёмные волосы, зелёный пиджак (или оставьте пустым — ИИ придумает)"
                  className={inputCls}
                />
              </div>
            )}

            <div>
              <Label>Тема / продукт</Label>
              <input
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Курс английского: заговори за 2 месяца"
                className={inputCls}
              />
            </div>

            <div>
              <Label>Стиль</Label>
              <select value={style} onChange={(e) => setStyle(e.target.value)} className={inputCls}>
                {STYLES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
              <div>
                <Label>CTA (призыв к действию)</Label>
                <input
                  value={cta}
                  onChange={(e) => setCta(e.target.value)}
                  placeholder="Запишись на бесплатный пробный урок"
                  className={inputCls}
                />
              </div>
              <div>
                <Label>Язык</Label>
                <select value={lang} onChange={(e) => setLang(e.target.value)} className={inputCls}>
                  {LANGS.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            <div>
              <Label>Формат</Label>
              <Seg value={ratio} options={PHOTO_RATIOS} onChange={setRatio} cols={3} />
            </div>
            <div>
              <Label>Тип</Label>
              <Seg value={ptype} options={PHOTO_TYPES} onChange={setPtype} cols={2} />
            </div>
            <div>
              <Label>Оффер / текст на баннере</Label>
              <input
                value={offer}
                onChange={(e) => setOffer(e.target.value)}
                placeholder="Первый урок бесплатно"
                className={inputCls}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
              <div>
                <Label>Объект / персонаж</Label>
                <input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Улыбающаяся девушка с ноутбуком"
                  className={inputCls}
                />
              </div>
              <div>
                <Label>Язык</Label>
                <select value={lang} onChange={(e) => setLang(e.target.value)} className={inputCls}>
                  {LANGS.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

        <button
          type="button"
          onClick={run}
          disabled={pending}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-5 py-3.5 text-base font-semibold text-white transition hover:bg-brand-strong disabled:opacity-50"
        >
          {pending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
          {pending ? "Генерирую…" : tab === "video" ? "Сгенерировать сценарий" : "Сгенерировать промт"}
        </button>

        {output && (
          <div className="mt-6 border-t border-line pt-5">
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

      {/* История */}
      {recent.length > 0 && (
        <div>
          <h2 className="mb-3 text-base font-semibold text-ink">История</h2>
          <div className="space-y-2.5">
            {recent.map((r) => (
              <details key={r.id} className="rounded-card bg-surface shadow-soft ring-1 ring-line">
                <summary className="flex cursor-pointer list-none items-center gap-3 p-4">
                  {r.tool === "photo_creative" ? (
                    <ImageIcon className="h-4 w-4 shrink-0 text-brand" />
                  ) : (
                    <Film className="h-4 w-4 shrink-0 text-brand" />
                  )}
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
