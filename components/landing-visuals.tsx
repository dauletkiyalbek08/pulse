"use client";

/** Общие визуалы публичных лендингов: анимированный фон, сцена с достопримечательностями, CSS. */

/** Светящиеся плавающие пятна на тёмном фоне. */
export function LandingBlobs({ accent }: { accent: string }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        className="hl-blob absolute -left-24 -top-24 h-72 w-72 rounded-full opacity-30 blur-3xl"
        style={{ backgroundColor: accent }}
      />
      <div className="hl-blob2 absolute -right-20 top-40 h-64 w-64 rounded-full bg-indigo-500 opacity-25 blur-3xl" />
      <div className="hl-blob3 absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-sky-500 opacity-20 blur-3xl" />
    </div>
  );
}

/** Флажки 🇬🇧 🇺🇸 с лёгким покачиванием. */
export function Flags() {
  return (
    <div className="flex items-center gap-1 text-2xl">
      <span className="hl-flag">🇬🇧</span>
      <span className="hl-flag" style={{ animationDelay: "0.6s" }}>
        🇺🇸
      </span>
    </div>
  );
}

/** Стилизованная сцена: Статуя Свободы + Биг-Бен + самолёт и облака. */
export function Skyline({ accent, className = "" }: { accent: string; className?: string }) {
  return (
    <svg viewBox="0 0 360 130" className={`w-full max-w-md ${className}`} fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* самолёт */}
      <g className="hl-plane">
        <path d="M20 30 l30 6 l8 -8 l4 2 l-3 9 l14 3 l6 -5 l3 2 l-6 12 -46 -8 z" fill="#ffffff" opacity="0.9" />
      </g>
      {/* облака */}
      <g fill="#ffffff" opacity="0.12">
        <ellipse className="hl-cloud" cx="300" cy="34" rx="34" ry="12" />
        <ellipse className="hl-cloud2" cx="250" cy="58" rx="26" ry="9" />
      </g>

      {/* Статуя Свободы (стилизованная) */}
      <g className="hl-float" transform="translate(74 24)">
        <path d="M20 0 l4 8 -8 0 z" fill={accent} />
        <path d="M17 8 h6 v5 h-6 z" fill="#cbd5e1" />
        <path d="M20 13 l10 20 -6 3 -8 -18 z" fill="#94a3b8" />
        <circle cx="30" cy="40" r="7" fill="#cbd5e1" />
        <g stroke={accent} strokeWidth="2" strokeLinecap="round">
          <line x1="30" y1="31" x2="30" y2="26" />
          <line x1="24" y1="34" x2="20" y2="31" />
          <line x1="36" y1="34" x2="40" y2="31" />
          <line x1="26" y1="32" x2="24" y2="28" />
          <line x1="34" y1="32" x2="36" y2="28" />
        </g>
        <path d="M30 47 C22 52 20 70 18 92 L46 92 C44 70 42 54 34 48 Z" fill="#94a3b8" />
        <path d="M30 47 C27 55 27 74 27 92 L34 92 C34 74 34 56 34 48 Z" fill="#cbd5e1" opacity="0.6" />
        <path d="M12 92 h44 v10 h-44 z" fill="#64748b" />
        <path d="M8 102 h52 v6 h-52 z" fill="#475569" />
      </g>

      {/* Биг-Бен (стилизованный) */}
      <g className="hl-float2" transform="translate(238 16)">
        <path d="M22 0 l8 18 -16 0 z" fill={accent} />
        <rect x="18" y="18" width="8" height="6" fill="#cbd5e1" />
        <rect x="12" y="24" width="20" height="14" fill="#94a3b8" />
        <circle cx="22" cy="31" r="5.5" fill="#f8fafc" stroke="#475569" strokeWidth="1.5" />
        <line x1="22" y1="31" x2="22" y2="27.5" stroke="#0b1020" strokeWidth="1.2" strokeLinecap="round" />
        <line x1="22" y1="31" x2="25" y2="32.5" stroke="#0b1020" strokeWidth="1.2" strokeLinecap="round" />
        <rect x="14" y="38" width="16" height="52" fill="#cbd5e1" />
        <g fill="#94a3b8">
          <rect x="17" y="44" width="3" height="7" />
          <rect x="24" y="44" width="3" height="7" />
          <rect x="17" y="56" width="3" height="7" />
          <rect x="24" y="56" width="3" height="7" />
          <rect x="17" y="68" width="3" height="7" />
          <rect x="24" y="68" width="3" height="7" />
        </g>
        <rect x="11" y="90" width="22" height="10" fill="#64748b" />
      </g>

      <path d="M0 110 h360" stroke="#ffffff" strokeOpacity="0.1" strokeWidth="2" />
    </svg>
  );
}

export const LANDING_CSS = `
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
