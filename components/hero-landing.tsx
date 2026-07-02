"use client";

import { useState } from "react";
import {
  Loader2,
  CheckCircle2,
  MessageCircle,
  GraduationCap,
  Clock,
  Trophy,
  Sparkles,
} from "lucide-react";

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
  pixelId,
  logo,
  title,
  subtitle,
  bullets,
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
      <style>{CSS}</style>

      {/* Фоновые светящиеся пятна */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="hl-blob absolute -left-24 -top-24 h-72 w-72 rounded-full opacity-30 blur-3xl"
          style={{ backgroundColor: accent }}
        />
        <div className="hl-blob2 absolute -right-20 top-40 h-64 w-64 rounded-full bg-indigo-500 opacity-25 blur-3xl" />
        <div className="hl-blob3 absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-sky-500 opacity-20 blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-lg flex-col px-5 pb-10 pt-8">
        {/* Логотип + флаги */}
        <div className="hl-fade flex items-center justify-between" style={{ animationDelay: "0ms" }}>
          <div className="flex items-center gap-2 text-lg font-bold tracking-tight">
            <span
              className="flex h-8 w-8 items-center justify-center rounded-xl text-sm font-black text-white shadow-lg"
              style={{ backgroundColor: accent }}
            >
              A
            </span>
            {logo || "bilimdibol.eng"}
          </div>
          <div className="flex items-center gap-1 text-2xl">
            <span className="hl-flag">🇬🇧</span>
            <span className="hl-flag" style={{ animationDelay: "0.6s" }}>
              🇺🇸
            </span>
          </div>
        </div>

        {/* Иллюстрация */}
        <div className="hl-fade relative mt-6 flex justify-center" style={{ animationDelay: "120ms" }}>
          <Skyline accent={accent} />
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
                  <span className="flex select-none items-center gap-1 border-r border-gray-200 px-3.5 text-base font-medium text-gray-700">
                    🇰🇿 +7
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
          © {new Date().getFullYear()} {logo || "bilimdibol.eng"}
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

/** Стилизованная сцена: Статуя Свободы + Биг-Бен + самолёт и облака. */
function Skyline({ accent }: { accent: string }) {
  return (
    <svg viewBox="0 0 360 190" className="w-full max-w-md" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* самолёт */}
      <g className="hl-plane">
        <path d="M20 34 l30 6 l8 -8 l4 2 l-3 9 l14 3 l6 -5 l3 2 l-6 12 -46 -8 z" fill="#ffffff" opacity="0.9" />
      </g>
      {/* облака */}
      <g fill="#ffffff" opacity="0.12">
        <ellipse className="hl-cloud" cx="300" cy="40" rx="34" ry="12" />
        <ellipse className="hl-cloud2" cx="250" cy="66" rx="26" ry="9" />
      </g>

      {/* Статуя Свободы (стилизованная) */}
      <g className="hl-float" transform="translate(70 34)">
        {/* факел */}
        <path d="M20 0 l4 8 -8 0 z" fill={accent} />
        <path d="M17 8 h6 v5 h-6 z" fill="#cbd5e1" />
        {/* поднятая рука */}
        <path d="M20 13 l10 20 -6 3 -8 -18 z" fill="#94a3b8" />
        {/* голова + корона */}
        <circle cx="30" cy="40" r="7" fill="#cbd5e1" />
        <g stroke={accent} strokeWidth="2" strokeLinecap="round">
          <line x1="30" y1="31" x2="30" y2="26" />
          <line x1="24" y1="34" x2="20" y2="31" />
          <line x1="36" y1="34" x2="40" y2="31" />
          <line x1="26" y1="32" x2="24" y2="28" />
          <line x1="34" y1="32" x2="36" y2="28" />
        </g>
        {/* тело (мантия) */}
        <path d="M30 47 C22 52 20 70 18 92 L46 92 C44 70 42 54 34 48 Z" fill="#94a3b8" />
        <path d="M30 47 C27 55 27 74 27 92 L34 92 C34 74 34 56 34 48 Z" fill="#cbd5e1" opacity="0.6" />
        {/* пьедестал */}
        <path d="M12 92 h44 v10 h-44 z" fill="#64748b" />
        <path d="M8 102 h52 v8 h-52 z" fill="#475569" />
      </g>

      {/* Биг-Бен (стилизованный) */}
      <g className="hl-float2" transform="translate(236 20)">
        {/* шпиль */}
        <path d="M22 0 l8 18 -16 0 z" fill={accent} />
        <rect x="18" y="18" width="8" height="6" fill="#cbd5e1" />
        {/* верх башни */}
        <rect x="12" y="24" width="20" height="14" fill="#94a3b8" />
        {/* циферблат */}
        <circle cx="22" cy="31" r="5.5" fill="#f8fafc" stroke="#475569" strokeWidth="1.5" />
        <line x1="22" y1="31" x2="22" y2="27.5" stroke="#0b1020" strokeWidth="1.2" strokeLinecap="round" />
        <line x1="22" y1="31" x2="25" y2="32.5" stroke="#0b1020" strokeWidth="1.2" strokeLinecap="round" />
        {/* ствол башни */}
        <rect x="14" y="38" width="16" height="52" fill="#cbd5e1" />
        <g fill="#94a3b8">
          <rect x="17" y="44" width="3" height="7" />
          <rect x="24" y="44" width="3" height="7" />
          <rect x="17" y="56" width="3" height="7" />
          <rect x="24" y="56" width="3" height="7" />
          <rect x="17" y="68" width="3" height="7" />
          <rect x="24" y="68" width="3" height="7" />
        </g>
        {/* основание */}
        <rect x="11" y="90" width="22" height="10" fill="#64748b" />
      </g>

      {/* земля */}
      <path d="M0 112 h360" stroke="#ffffff" strokeOpacity="0.1" strokeWidth="2" />
    </svg>
  );
}

const CSS = `
@keyframes hlFade { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: translateY(0); } }
.hl-fade { opacity: 0; animation: hlFade .7s cubic-bezier(.2,.7,.2,1) forwards; }
@keyframes hlFloat { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
.hl-float { animation: hlFloat 5s ease-in-out infinite; }
.hl-float2 { animation: hlFloat 6s ease-in-out infinite; animation-delay: .8s; }
@keyframes hlBlob { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(20px,25px) scale(1.15); } }
.hl-blob { animation: hlBlob 12s ease-in-out infinite; }
.hl-blob2 { animation: hlBlob 15s ease-in-out infinite reverse; }
.hl-blob3 { animation: hlBlob 18s ease-in-out infinite; }
@keyframes hlFlag { 0%,100% { transform: rotate(0deg); } 50% { transform: rotate(12deg); } }
.hl-flag { display: inline-block; animation: hlFlag 3s ease-in-out infinite; transform-origin: bottom left; }
@keyframes hlPlane { 0% { transform: translate(-40px,10px); } 100% { transform: translate(360px,-20px); } }
.hl-plane { animation: hlPlane 14s linear infinite; }
@keyframes hlCloud { 0% { transform: translateX(0); } 100% { transform: translateX(-60px); } }
.hl-cloud { animation: hlCloud 20s linear infinite alternate; }
.hl-cloud2 { animation: hlCloud 26s linear infinite alternate; }
@keyframes hlPop { 0% { transform: scale(.4); opacity: 0; } 60% { transform: scale(1.15); } 100% { transform: scale(1); opacity: 1; } }
.hl-pop { animation: hlPop .5s cubic-bezier(.2,.8,.2,1); }
.hl-cta:hover { transform: translateY(-1px); }
`;
