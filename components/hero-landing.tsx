"use client";

import { useEffect, useRef, useState } from "react";
import {
  Loader2,
  CheckCircle2,
  MessageCircle,
  GraduationCap,
  Clock,
  Trophy,
  Sparkles,
} from "lucide-react";
import { LandingBlobs, Flags, Skyline } from "@/components/landing-visuals";
import { newSessionId } from "@/lib/session-id";

function getCookie(name: string): string {
  if (typeof document === "undefined") return "";
  const m = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
  return m ? decodeURIComponent(m[2]) : "";
}

export interface HeroSocials {
  instagram?: string;
  telegram?: string;
  tiktok?: string;
}

const BENEFIT_ICONS = [MessageCircle, GraduationCap, Clock, Trophy];

const DEFAULT_BULLETS = [
  "2 айда еркін сөйлеп үйренесіз",
  "Тәжірибелі мұғаліммен онлайн сабақ",
  "Күніне бар болғаны 30 минут",
  "Сізге ыңғайлы жеке бағдарлама",
];

/**
 * Красивый анимированный лендинг-форма (не квиз): герой с иллюстрацией
 * английских/американских символов (Big Ben, Статуя Свободы), выгоды и форма.
 * Лид уходит в /api/site/leads с метками рекламы (fbc/fbp/fbclid).
 */
export function HeroLanding({
  token,
  landingId,
  pixelId,
  title,
  subtitle,
  bullets,
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
  bullets: string[];
  buttonText: string;
  thanksText: string;
  accent: string;
  socials: HeroSocials;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const items = bullets.length > 0 ? bullets : DEFAULT_BULLETS;

  // Трекинг воронки: показ (шаг 0) и отправка заявки (submitted).
  const sessionRef = useRef<string>("");
  if (!sessionRef.current) sessionRef.current = newSessionId();

  const track = (step: number, submitted = false) => {
    if (!landingId) return;
    try {
      fetch(`/api/site/track?t=${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ landing: landingId, session: sessionRef.current, step, submitted }),
        keepalive: true,
      }).catch(() => {});
    } catch {
      /* аналитика не критична */
    }
  };

  useEffect(() => {
    track(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (phone.length < 10) {
      setErr("Номеріңізді толық жазыңыз");
      return;
    }
    setBusy(true);
    try {
      const fbc = getCookie("_fbc");
      const fbp = getCookie("_fbp");
      const fbclid = new URLSearchParams(window.location.search).get("fbclid") ?? "";
      const res = await fetch(`/api/site/leads?t=${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone: `+7${phone}`, fbc, fbp, fbclid }),
      });
      if (!res.ok) throw new Error();
      const w = window as unknown as { fbq?: (...a: unknown[]) => void };
      if (pixelId && typeof w.fbq === "function") w.fbq("track", "Lead");
      track(1, true);
      setDone(true);
    } catch {
      setErr("Жіберілмеді. Қайта көріңіз.");
    } finally {
      setBusy(false);
    }
  }

  const phoneView =
    phone.length <= 3
      ? phone
      : phone.length <= 6
        ? `${phone.slice(0, 3)} ${phone.slice(3)}`
        : phone.length <= 8
          ? `${phone.slice(0, 3)} ${phone.slice(3, 6)} ${phone.slice(6)}`
          : `${phone.slice(0, 3)} ${phone.slice(3, 6)} ${phone.slice(6, 8)} ${phone.slice(8)}`;

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#0b1020] text-white">
      <LandingBlobs accent={accent} />

      <div className="relative mx-auto flex min-h-screen max-w-lg flex-col px-5 pb-10 pt-8">
        {/* Флаги-«мост» */}
        <div className="hl-fade flex justify-center" style={{ animationDelay: "0ms" }}>
          <Flags />
        </div>

        {/* Иллюстрация */}
        <div className="hl-fade relative mt-6 flex justify-center" style={{ animationDelay: "120ms" }}>
          <Skyline accent={accent} className="max-w-[240px]" />
        </div>

        {/* Заголовок */}
        <div className="hl-fade mt-2 text-center" style={{ animationDelay: "220ms" }}>
          <div
            className="mx-auto mb-3 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-white/80 backdrop-blur"
          >
            <Sparkles className="h-3.5 w-3.5" style={{ color: accent }} />
            Ағылшын тілі мектебі
          </div>
          <h1 className="text-[26px] font-extrabold leading-tight sm:text-4xl">{title}</h1>
          {subtitle && <p className="mx-auto mt-3 max-w-md text-[15px] text-white/70">{subtitle}</p>}
        </div>

        {/* Выгоды */}
        <div className="hl-fade mt-6 grid grid-cols-1 gap-2.5" style={{ animationDelay: "320ms" }}>
          {items.slice(0, 4).map((b, i) => {
            const Icon = BENEFIT_ICONS[i % BENEFIT_ICONS.length];
            return (
              <div
                key={i}
                className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur transition hover:border-white/20 hover:bg-white/[0.08]"
              >
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white shadow-lg"
                  style={{ backgroundColor: accent }}
                >
                  <Icon className="h-4.5 w-4.5" />
                </span>
                <span className="text-sm font-medium text-white/90">{b}</span>
              </div>
            );
          })}
        </div>

        {/* Форма */}
        <div className="hl-fade mt-7" style={{ animationDelay: "420ms" }}>
          {done ? (
            <div className="flex flex-col items-center gap-3 rounded-3xl border border-white/10 bg-white/5 px-6 py-12 text-center backdrop-blur">
              <CheckCircle2 className="hl-pop h-16 w-16" style={{ color: accent }} />
              <p className="text-xl font-semibold">{thanksText}</p>
            </div>
          ) : (
            <form
              onSubmit={submit}
              className="rounded-3xl border border-white/10 bg-white p-5 text-gray-900 shadow-2xl sm:p-6"
            >
              <p className="text-center text-base font-bold text-gray-900">
                Тегін орын қалдырыңыз — маманымыз хабарласады
              </p>
              <div className="mt-4 space-y-3">
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
          <div className="hl-fade mt-6 flex flex-wrap items-center justify-center gap-2" style={{ animationDelay: "520ms" }}>
            {socials.instagram && <Social href={socials.instagram} label="Instagram" />}
            {socials.telegram && <Social href={socials.telegram} label="Telegram" />}
            {socials.tiktok && <Social href={socials.tiktok} label="TikTok" />}
          </div>
        )}

        <div className="flex-1" />
        <p className="hl-fade mt-8 text-center text-xs text-white/40" style={{ animationDelay: "600ms" }}>
          © {new Date().getFullYear()} · Ағылшын тілі мектебі
        </p>
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
