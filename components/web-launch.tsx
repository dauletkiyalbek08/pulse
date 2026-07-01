"use client";

import { useRef, useState, useTransition } from "react";
import { Clapperboard, Loader2, Rocket, RefreshCw, CheckCircle2, Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  createAdVideoUploadUrl,
  createWebDraft,
  updateWebDraft,
  regenerateWebText,
  launchWebDraft,
} from "@/app/p/[projectId]/ads/launch-actions";

const GEO_OPTS = [
  { value: "", label: "Весь Казахстан" },
  { value: "Алматы", label: "Алматы" },
  { value: "Астана", label: "Астана" },
  { value: "Шымкент", label: "Шымкент" },
];

type Phase = "idle" | "uploading" | "processing" | "draft" | "launching" | "done";

/**
 * Запуск рекламы с загрузкой тяжёлого видео через сайт (без лимита Telegram):
 * браузер грузит файл в хранилище → Meta забирает по URL → черновик → запуск.
 */
export function WebLaunch({ projectId, defaultBudget }: { projectId: string; defaultBudget: number }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [offer, setOffer] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const [draftId, setDraftId] = useState<string | null>(null);
  const [headline, setHeadline] = useState("");
  const [primaryText, setPrimaryText] = useState("");
  const [geoCity, setGeoCity] = useState("");
  const [advantage, setAdvantage] = useState(false);

  const input =
    "w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink placeholder:text-faint focus:border-brand focus:outline-none";

  async function submitFiles() {
    setErr(null);
    const files = Array.from(fileRef.current?.files ?? []);
    if (files.length === 0) {
      setErr("Выберите видео и/или картинки.");
      return;
    }
    const bad = files.find((f) => !f.type.startsWith("video/") && !f.type.startsWith("image/"));
    if (bad) {
      setErr(`«${bad.name}» — не видео и не картинка.`);
      return;
    }
    setPhase("uploading");
    setProgress(0);

    // 1. Загрузка каждого файла напрямую в хранилище по подписанной ссылке
    const supabase = createClient();
    const items: { path: string; kind: "video" | "image" }[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const ticket = await createAdVideoUploadUrl(projectId, file.name);
      if (!ticket.ok || !ticket.path || !ticket.token) {
        setErr(ticket.error ?? "Ошибка загрузки");
        setPhase("idle");
        return;
      }
      const up = await supabase.storage.from("ad-videos").uploadToSignedUrl(ticket.path, ticket.token, file);
      if (up.error) {
        setErr(`Не удалось загрузить «${file.name}». Проверьте размер (до 500 МБ) и интернет.`);
        setPhase("idle");
        return;
      }
      items.push({ path: ticket.path, kind: file.type.startsWith("video/") ? "video" : "image" });
      setProgress(Math.round(((i + 1) / files.length) * 100));
    }

    // 2. Черновик: Meta забирает файлы + AI-текст
    setPhase("processing");
    const res = await createWebDraft(projectId, items, offer);
    if (!res.ok || !res.draftId) {
      setErr(res.error ?? "Не удалось создать черновик");
      setPhase("idle");
      return;
    }
    setDraftId(res.draftId);
    setHeadline(res.headline ?? "");
    setPrimaryText(res.primaryText ?? "");
    setPhase("draft");
  }

  function regenerate() {
    if (!draftId) return;
    start(async () => {
      const r = await regenerateWebText(projectId, draftId);
      if (r.ok) {
        setHeadline(r.headline ?? "");
        setPrimaryText(r.primaryText ?? "");
      }
    });
  }

  function launch() {
    if (!draftId) return;
    setErr(null);
    start(async () => {
      // Сохранить правки текста/гео/Advantage перед запуском
      await updateWebDraft(projectId, draftId, {
        headline,
        primaryText,
        geoCity: geoCity || null,
        advantage,
      });
      setPhase("launching");
      const r = await launchWebDraft(projectId, draftId);
      if (r.ok) {
        setPhase("done");
      } else {
        setErr(r.error ?? "Не удалось запустить");
        setPhase("draft");
      }
    });
  }

  function reset() {
    setPhase("idle");
    setDraftId(null);
    setOffer("");
    setHeadline("");
    setPrimaryText("");
    setGeoCity("");
    setAdvantage(false);
    setErr(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div className="rounded-card bg-surface p-5 shadow-soft ring-1 ring-line">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-soft text-brand-ink">
          <Clapperboard className="h-5 w-5" />
        </span>
        <div>
          <div className="text-sm font-semibold text-ink">Запуск с загрузкой креативов</div>
          <div className="text-xs text-muted">Несколько видео и/или картинок в одну кампанию · до 500 МБ каждый</div>
        </div>
      </div>

      {phase === "done" ? (
        <div className="flex flex-col items-start gap-3 rounded-lg bg-brand-soft/50 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-brand-ink">
            <CheckCircle2 className="h-5 w-5" /> Реклама запущена на модерацию Meta
          </div>
          <p className="text-xs text-muted">
            Как одобрят — начнёт откручиваться. Результаты появятся в этом разделе и в «Отчётах».
          </p>
          <button onClick={reset} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-strong">
            Запустить ещё
          </button>
        </div>
      ) : phase === "draft" || phase === "launching" ? (
        <div className="space-y-3">
          <label className="block text-xs text-muted">
            Заголовок
            <input value={headline} onChange={(e) => setHeadline(e.target.value)} className={`mt-1 ${input}`} />
          </label>
          <label className="block text-xs text-muted">
            Текст объявления
            <textarea
              value={primaryText}
              onChange={(e) => setPrimaryText(e.target.value)}
              rows={4}
              className={`mt-1 ${input}`}
            />
          </label>
          <button
            type="button"
            onClick={regenerate}
            disabled={pending}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-ink hover:underline disabled:opacity-60"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Сгенерировать текст заново (AI)
          </button>

          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs text-muted">
              Гео
              <select value={geoCity} onChange={(e) => setGeoCity(e.target.value)} className={`mt-1 ${input}`}>
                {GEO_OPTS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-end gap-2 pb-2 text-xs text-muted">
              <input type="checkbox" checked={advantage} onChange={(e) => setAdvantage(e.target.checked)} />
              Advantage-аудитория (шире)
            </label>
          </div>

          {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{err}</p>}

          <button
            type="button"
            onClick={launch}
            disabled={pending || phase === "launching"}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-strong disabled:opacity-60"
          >
            {phase === "launching" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
            Запустить · ${defaultBudget}/день
          </button>
          <p className="text-center text-xs text-faint">Уйдёт на модерацию Meta · цель «Лиды» · на квиз</p>
        </div>
      ) : (
        <div className="space-y-3">
          <input ref={fileRef} type="file" multiple accept="video/*,image/*" className="block w-full text-sm text-ink file:mr-3 file:rounded-lg file:border-0 file:bg-brand-soft file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand-ink" />
          <p className="text-xs text-faint">Можно выбрать несколько файлов сразу (видео MP4/MOV и картинки JPG/PNG). Meta протестит их между собой на один бюджет.</p>
          <textarea
            value={offer}
            onChange={(e) => setOffer(e.target.value)}
            rows={2}
            placeholder="Оффер / о чём реклама (например: Ағылшын тілі курсы — топтық сабақ). AI напишет текст."
            className={input}
          />
          {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{err}</p>}
          <button
            type="button"
            onClick={submitFiles}
            disabled={phase === "uploading" || phase === "processing"}
            className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-strong disabled:opacity-60"
          >
            {phase === "uploading" ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Загрузка… {progress}%
              </>
            ) : phase === "processing" ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Готовлю черновик…
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" /> Загрузить и создать черновик
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
