"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, CheckCircle2, ArrowLeft, Sparkles } from "lucide-react";
import type { QuizQuestion } from "@/lib/quiz-sample";
import { LandingBlobs, Flags, Skyline } from "@/components/landing-visuals";
import { newSessionId } from "@/lib/session-id";

function getCookie(name: string): string {
  if (typeof document === "undefined") return "";
  const m = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
  return m ? decodeURIComponent(m[2]) : "";
}

export interface QuizSocials {
  instagram?: string;
  telegram?: string;
  tiktok?: string;
}

/** Публичная квиз-воронка: интро → вопросы → форма. Лид уходит в /api/site/leads. */
export function QuizFunnel({
  token,
  landingId,
  pixelId,
  title,
  subtitle,
  startButton,
  questions,
  buttonText,
  thanksText,
  accent,
  socials,
}: {
  token: string;
  landingId?: string;
  pixelId: string | null;
  logo?: string | null;
  title: string;
  subtitle: string;
  startButton: string;
  questions: QuizQuestion[];
  buttonText: string;
  thanksText: string;
  accent: string;
  socials: QuizSocials;
}) {
  const total = questions.length;
  // step: 0 — интро, 1..total — вопросы, total+1 — форма
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<string[]>(Array(total).fill(""));
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Трекинг воронки: сессия + отправка самого дальнего шага (без ПДн).
  const sessionRef = useRef<string>("");
  if (!sessionRef.current) sessionRef.current = newSessionId();
  const sentStep = useRef(-1);

  const track = useCallback(
    (s: number, submitted = false) => {
      if (!landingId) return;
      try {
        fetch(`/api/site/track?t=${encodeURIComponent(token)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ landing: landingId, session: sessionRef.current, step: s, submitted }),
          keepalive: true,
        }).catch(() => {});
      } catch {
        /* аналитика не критична */
      }
    },
    [landingId, token],
  );

  // Первый показ + каждый новый максимальный шаг.
  useEffect(() => {
    if (step > sentStep.current) {
      sentStep.current = step;
      track(step);
    }
  }, [step, track]);

  function pick(qi: number, option: string) {
    setAnswers((a) => {
      const next = [...a];
      next[qi] = option;
      return next;
    });
    setStep(qi + 2); // следующий шаг (вопрос qi+1 → step qi+2)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (phone.length < 10) {
      setErr("Номеріңізді толық жазыңыз");
      return;
    }
    setBusy(true);
    try {
      const note = questions.map((q, i) => `${q.q} — ${answers[i] || "—"}`).join("\n");
      const fbc = getCookie("_fbc");
      const fbp = getCookie("_fbp");
      const qs = new URLSearchParams(window.location.search);
      const fbclid = qs.get("fbclid") ?? "";
      const res = await fetch(`/api/site/leads?t=${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          phone: `+7${phone}`,
          fbc,
          fbp,
          fbclid,
          note,
          c: qs.get("c") ?? "",
          as: qs.get("as") ?? "",
          ad: qs.get("ad") ?? "",
        }),
      });
      if (!res.ok) throw new Error();
      const w = window as unknown as { fbq?: (...a: unknown[]) => void };
      if (pixelId && typeof w.fbq === "function") w.fbq("track", "Lead");
      track(total + 1, true);
      setDone(true);
    } catch {
      setErr("Жіберілмеді. Қайта көріңіз.");
    } finally {
      setBusy(false);
    }
  }

  // Красивый вид номера: «700 000 00 00» (в состоянии храним только цифры).
  const phoneView =
    phone.length <= 3
      ? phone
      : phone.length <= 6
        ? `${phone.slice(0, 3)} ${phone.slice(3)}`
        : phone.length <= 8
          ? `${phone.slice(0, 3)} ${phone.slice(3, 6)} ${phone.slice(6)}`
          : `${phone.slice(0, 3)} ${phone.slice(3, 6)} ${phone.slice(6, 8)} ${phone.slice(8)}`;

  const Header = (
    <div className="flex justify-center">
      <Flags />
    </div>
  );

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#0b1020] text-white">
      <LandingBlobs accent={accent} />

      <div className="relative mx-auto flex min-h-screen max-w-lg flex-col px-5 py-8">
        {Header}

        {/* Прогресс (на шагах вопросов/формы) */}
        {step >= 1 && step <= total + 1 && !done && (
          <div className="hl-fade mt-6">
            <div className="mb-1.5 flex items-center justify-between text-xs text-white/60">
              <span>
                Қадам: {Math.min(step, total + 1)} / {total + 1}
              </span>
              {step > 1 && (
                <button
                  type="button"
                  onClick={() => setStep((s) => s - 1)}
                  className="inline-flex items-center gap-1 transition hover:text-white"
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> Артқа
                </button>
              )}
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ backgroundColor: accent, width: `${(Math.min(step, total + 1) / (total + 1)) * 100}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex flex-1 flex-col justify-center py-4">
          {done ? (
            <div className="flex flex-col items-center gap-3 rounded-3xl border border-white/10 bg-white/5 px-6 py-14 text-center backdrop-blur">
              <CheckCircle2 className="hl-pop h-16 w-16" style={{ color: accent }} />
              <p className="text-xl font-semibold">{thanksText}</p>
            </div>
          ) : step === 0 ? (
            /* Интро */
            <div className="text-center">
              <div className="hl-fade flex justify-center" style={{ animationDelay: "80ms" }}>
                <Skyline accent={accent} className="max-w-[230px]" />
              </div>
              <div className="hl-fade" style={{ animationDelay: "200ms" }}>
                <div className="mx-auto mb-3 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-white/80 backdrop-blur">
                  <Sparkles className="h-3.5 w-3.5" style={{ color: accent }} />
                  Ағылшын тілі мектебі
                </div>
                <h1 className="text-2xl font-extrabold leading-tight sm:text-3xl">{title}</h1>
                {subtitle && <p className="mx-auto mt-2.5 max-w-md text-sm text-white/70">{subtitle}</p>}
              </div>
              <button
                type="button"
                onClick={() => setStep(1)}
                style={{ backgroundColor: accent }}
                className="hl-cta mt-6 w-full rounded-xl px-5 py-4 text-base font-bold text-white shadow-lg transition hover:opacity-95"
              >
                {startButton}
              </button>
            </div>
          ) : step <= total ? (
            /* Вопрос */
            <div className="hl-fade" key={step}>
              <h2 className="text-xl font-bold text-white sm:text-2xl">{questions[step - 1]?.q}</h2>
              <div className="mt-5 space-y-2.5">
                {(questions[step - 1]?.options ?? []).map((opt, oi) => {
                  const active = answers[step - 1] === opt;
                  return (
                    <button
                      key={oi}
                      type="button"
                      onClick={() => pick(step - 1, opt)}
                      style={active ? { borderColor: accent, backgroundColor: `${accent}22` } : undefined}
                      className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3.5 text-left text-[15px] text-white/90 backdrop-blur transition hover:border-white/25 hover:bg-white/10"
                    >
                      <span
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white"
                        style={{ backgroundColor: accent }}
                      >
                        {String.fromCharCode(65 + oi)}
                      </span>
                      {opt}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            /* Финальная форма */
            <form onSubmit={submit} className="hl-fade rounded-3xl border border-white/10 bg-white p-5 text-gray-900 shadow-2xl sm:p-6">
              <h2 className="text-xl font-bold text-gray-900">Дерлік дайын! 🎉</h2>
              <p className="mt-1 text-sm text-gray-600">Нәтижені жіберу үшін байланыс қалдырыңыз.</p>
              <div className="mt-5 space-y-3">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Аты-жөніңіз"
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3.5 text-base text-gray-900 placeholder:text-gray-400 transition focus:border-gray-400 focus:bg-white focus:outline-none"
                />
                <div className="flex items-stretch overflow-hidden rounded-xl border border-gray-200 bg-gray-50 transition focus-within:border-gray-400 focus-within:bg-white">
                  <span className="flex select-none items-center gap-1.5 whitespace-nowrap border-r border-gray-200 px-3.5 text-base font-medium text-gray-700">
                    <span className="text-lg leading-none">🇰🇿</span>
                    <span>+7</span>
                  </span>
                  <input
                    value={phoneView}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel"
                    placeholder="700 000 00 00"
                    className="w-full bg-transparent px-4 py-3.5 text-base text-gray-900 placeholder:text-gray-400 focus:outline-none"
                  />
                </div>
                {err && <p className="text-sm text-red-600">{err}</p>}
                <button
                  type="submit"
                  disabled={busy}
                  style={{ backgroundColor: accent }}
                  className="hl-cta flex w-full items-center justify-center gap-2 rounded-xl px-5 py-4 text-base font-bold text-white shadow-lg transition hover:opacity-95 disabled:opacity-60"
                >
                  {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
                  {buttonText}
                </button>
                <p className="text-center text-xs text-gray-400">
                  Жіберу арқылы дербес деректерді өңдеуге келісім бересіз
                </p>
              </div>
            </form>
          )}
        </div>

        {/* Соцсети */}
        {(socials.instagram || socials.telegram || socials.tiktok) && (
          <div className="flex flex-wrap items-center justify-center gap-2 pb-2">
            {socials.instagram && <Social href={socials.instagram} label="Instagram" />}
            {socials.telegram && <Social href={socials.telegram} label="Telegram" />}
            {socials.tiktok && <Social href={socials.tiktok} label="TikTok" />}
          </div>
        )}
      </div>
    </main>
  );
}

function Social({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs font-medium text-white/80 backdrop-blur transition hover:bg-white/10"
    >
      {label}
    </a>
  );
}
