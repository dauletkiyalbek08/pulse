"use client";

import { useState } from "react";
import { Loader2, CheckCircle2, ArrowLeft } from "lucide-react";
import type { QuizQuestion } from "@/lib/quiz-sample";

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
  pixelId,
  logo,
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
  pixelId: string | null;
  logo: string | null;
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
    if (phone.trim().length < 6) {
      setErr("Номеріңізді жазыңыз");
      return;
    }
    setBusy(true);
    try {
      const note = questions.map((q, i) => `${q.q} — ${answers[i] || "—"}`).join("\n");
      const fbc = getCookie("_fbc");
      const fbp = getCookie("_fbp");
      const fbclid = new URLSearchParams(window.location.search).get("fbclid") ?? "";
      const res = await fetch(`/api/site/leads?t=${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, fbc, fbp, fbclid, note }),
      });
      if (!res.ok) throw new Error();
      const w = window as unknown as { fbq?: (...a: unknown[]) => void };
      if (pixelId && typeof w.fbq === "function") w.fbq("track", "Lead");
      setDone(true);
    } catch {
      setErr("Жіберілмеді. Қайта көріңіз.");
    } finally {
      setBusy(false);
    }
  }

  const Header = (
    <div className="flex flex-col items-center gap-3">
      {logo && <div className="text-lg font-bold tracking-tight text-gray-900">{logo}</div>}
      {(socials.instagram || socials.telegram || socials.tiktok) && (
        <div className="flex flex-wrap items-center justify-center gap-2 text-xs">
          {socials.instagram && (
            <a href={socials.instagram} target="_blank" rel="noreferrer" className="rounded-full bg-white px-3 py-1 text-gray-700 ring-1 ring-gray-200 transition hover:ring-gray-300">
              Instagram
            </a>
          )}
          {socials.telegram && (
            <a href={socials.telegram} target="_blank" rel="noreferrer" className="rounded-full bg-white px-3 py-1 text-gray-700 ring-1 ring-gray-200 transition hover:ring-gray-300">
              Telegram
            </a>
          )}
          {socials.tiktok && (
            <a href={socials.tiktok} target="_blank" rel="noreferrer" className="rounded-full bg-white px-3 py-1 text-gray-700 ring-1 ring-gray-200 transition hover:ring-gray-300">
              TikTok
            </a>
          )}
        </div>
      )}
    </div>
  );

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
      <div className="mx-auto flex min-h-screen max-w-lg flex-col px-5 py-10">
        {Header}

        {/* Прогресс */}
        {step >= 1 && step <= total + 1 && (
          <div className="mt-6">
            <div className="mb-1 flex items-center justify-between text-xs text-gray-500">
              <span>Қадам: {Math.min(step, total + 1)} / {total + 1}</span>
              {step > 1 && !done && (
                <button
                  type="button"
                  onClick={() => setStep((s) => s - 1)}
                  className="inline-flex items-center gap-1 hover:text-gray-700"
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> Артқа
                </button>
              )}
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-gray-200">
              <div
                className="h-full rounded-full transition-all"
                style={{ backgroundColor: accent, width: `${(Math.min(step, total + 1) / (total + 1)) * 100}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex flex-1 flex-col justify-center py-8">
          {done ? (
            <div className="flex flex-col items-center gap-3 text-center">
              <CheckCircle2 className="h-14 w-14" style={{ color: accent }} />
              <p className="text-xl font-semibold text-gray-900">{thanksText}</p>
            </div>
          ) : step === 0 ? (
            /* Интро */
            <div className="text-center">
              <h1 className="text-2xl font-bold leading-tight text-gray-900 sm:text-3xl">{title}</h1>
              {subtitle && <p className="mx-auto mt-3 max-w-md text-gray-600">{subtitle}</p>}
              <button
                type="button"
                onClick={() => setStep(1)}
                style={{ backgroundColor: accent }}
                className="mt-7 w-full rounded-xl px-5 py-4 text-base font-semibold text-white shadow-sm transition hover:opacity-90"
              >
                {startButton}
              </button>
            </div>
          ) : step <= total ? (
            /* Вопрос */
            <div>
              <h2 className="text-xl font-semibold text-gray-900">{questions[step - 1]?.q}</h2>
              <div className="mt-5 space-y-2.5">
                {(questions[step - 1]?.options ?? []).map((opt, oi) => {
                  const active = answers[step - 1] === opt;
                  return (
                    <button
                      key={oi}
                      type="button"
                      onClick={() => pick(step - 1, opt)}
                      style={active ? { borderColor: accent, backgroundColor: `${accent}11` } : undefined}
                      className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3.5 text-left text-[15px] text-gray-800 transition hover:border-gray-300 hover:bg-gray-50"
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            /* Финальная форма */
            <form onSubmit={submit}>
              <h2 className="text-xl font-semibold text-gray-900">Дерлік дайын! 🎉</h2>
              <p className="mt-1 text-sm text-gray-600">Нәтижені жіберу үшін байланыс қалдырыңыз.</p>
              <div className="mt-5 space-y-3">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Аты-жөніңіз"
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3.5 text-base text-gray-900 placeholder:text-gray-400 focus:border-gray-400 focus:outline-none"
                />
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  type="tel"
                  inputMode="tel"
                  placeholder="Номеріңіз"
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3.5 text-base text-gray-900 placeholder:text-gray-400 focus:border-gray-400 focus:outline-none"
                />
                {err && <p className="text-sm text-red-600">{err}</p>}
                <button
                  type="submit"
                  disabled={busy}
                  style={{ backgroundColor: accent }}
                  className="flex w-full items-center justify-center gap-2 rounded-xl px-5 py-4 text-base font-semibold text-white shadow-sm transition hover:opacity-90 disabled:opacity-60"
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
      </div>
    </main>
  );
}
