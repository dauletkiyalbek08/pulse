"use client";

/** Общие визуалы публичных лендингов: анимированный фон, сцена с достопримечательностями, CSS. */

/** Мягкие светящиеся пятна на тёмном фоне (спокойные, не мешают контенту). */
export function LandingBlobs({ accent }: { accent: string }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        className="hl-blob absolute -left-28 -top-28 h-72 w-72 rounded-full opacity-20 blur-3xl"
        style={{ backgroundColor: accent }}
      />
      <div className="hl-blob3 absolute -bottom-24 -right-16 h-72 w-72 rounded-full bg-sky-500 opacity-15 blur-3xl" />
    </div>
  );
}

/** Флажки 🇬🇧 ✈️ 🇺🇸 — «мост» между странами, с лёгким покачиванием. */
export function Flags() {
  return (
    <div className="flex items-center gap-2 text-2xl">
      <span className="hl-flag">🇬🇧</span>
      <span className="hl-planeMini text-lg">✈️</span>
      <span className="hl-flag" style={{ animationDelay: "0.6s" }}>
        🇺🇸
      </span>
    </div>
  );
}

/**
 * Стилизованная сцена: Статуя Свободы и Биг-Бен рядом по центру, над ними
 * по дуге летит самолётик (эмодзи), сверху — мерцающие звёзды.
 */
export function Skyline({ accent, className = "" }: { accent: string; className?: string }) {
  return (
    <svg viewBox="0 0 320 150" className={`w-full max-w-sm ${className}`} fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* звёзды */}
      <g fill="#ffffff">
        <circle className="hl-tw" cx="36" cy="20" r="1.5" />
        <circle className="hl-tw2" cx="88" cy="12" r="1.1" />
        <circle className="hl-tw" cx="230" cy="16" r="1.4" />
        <circle className="hl-tw2" cx="286" cy="30" r="1.1" />
        <circle className="hl-tw" cx="160" cy="8" r="1.2" />
      </g>

      {/* пунктирная дуга перелёта */}
      <path d="M30 66 Q160 6 290 66" stroke="#ffffff" strokeOpacity="0.14" strokeWidth="1.5" strokeDasharray="4 6" />
      {/* самолётик (эмодзи — узнаваемый) */}
      <g className="hl-fly">
        <text x="-9" y="6" fontSize="17">✈️</text>
      </g>

      {/* Статуя Свободы (стилизованная) */}
      <g className="hl-float" transform="translate(96 34)">
        <path d="M20 0 l4 8 -8 0 z" fill={accent} />
        <path d="M17 8 h6 v5 h-6 z" fill="#e2e8f0" />
        <path d="M20 13 l10 20 -6 3 -8 -18 z" fill="#94a3b8" />
        <circle cx="30" cy="40" r="7" fill="#e2e8f0" />
        <g stroke={accent} strokeWidth="2" strokeLinecap="round">
          <line x1="30" y1="31" x2="30" y2="26" />
          <line x1="24" y1="34" x2="20" y2="31" />
          <line x1="36" y1="34" x2="40" y2="31" />
          <line x1="26" y1="32" x2="24" y2="28" />
          <line x1="34" y1="32" x2="36" y2="28" />
        </g>
        <path d="M30 47 C22 52 20 70 18 92 L46 92 C44 70 42 54 34 48 Z" fill="#cbd5e1" />
        <path d="M30 47 C27 55 27 74 27 92 L34 92 C34 74 34 56 34 48 Z" fill="#e2e8f0" opacity="0.7" />
        <path d="M12 92 h44 v10 h-44 z" fill="#94a3b8" />
        <path d="M8 102 h52 v6 h-52 z" fill="#64748b" />
      </g>

      {/* Биг-Бен (стилизованный) */}
      <g className="hl-float2" transform="translate(184 26)">
        <path d="M20 0 l7 16 -14 0 z" fill={accent} />
        <rect x="16" y="16" width="8" height="6" fill="#e2e8f0" />
        <rect x="11" y="22" width="18" height="13" fill="#cbd5e1" />
        <circle cx="20" cy="28.5" r="5" fill="#f8fafc" stroke="#64748b" strokeWidth="1.4" />
        <line x1="20" y1="28.5" x2="20" y2="25" stroke="#0b1020" strokeWidth="1.2" strokeLinecap="round" />
        <line x1="20" y1="28.5" x2="23" y2="30" stroke="#0b1020" strokeWidth="1.2" strokeLinecap="round" />
        <rect x="12" y="35" width="16" height="55" fill="#e2e8f0" />
        <g fill="#cbd5e1">
          <rect x="15" y="41" width="3" height="7" />
          <rect x="22" y="41" width="3" height="7" />
          <rect x="15" y="53" width="3" height="7" />
          <rect x="22" y="53" width="3" height="7" />
          <rect x="15" y="65" width="3" height="7" />
          <rect x="22" y="65" width="3" height="7" />
        </g>
        <rect x="9" y="90" width="22" height="10" fill="#94a3b8" />
      </g>

      {/* земля */}
      <path d="M40 138 h240" stroke="#ffffff" strokeOpacity="0.1" strokeWidth="2" />
    </svg>
  );
}

export const LANDING_CSS = `
@keyframes hlFade { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: translateY(0); } }
.hl-fade { opacity: 0; animation: hlFade .7s cubic-bezier(.2,.7,.2,1) forwards; }
@keyframes hlFloat { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
.hl-float { animation: hlFloat 6s ease-in-out infinite; }
.hl-float2 { animation: hlFloat 7s ease-in-out infinite; animation-delay: 1s; }
@keyframes hlBlob { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(16px,20px) scale(1.1); } }
.hl-blob { animation: hlBlob 16s ease-in-out infinite; }
.hl-blob3 { animation: hlBlob 20s ease-in-out infinite reverse; }
@keyframes hlFlag { 0%,100% { transform: rotate(0deg); } 50% { transform: rotate(12deg); } }
.hl-flag { display: inline-block; animation: hlFlag 3s ease-in-out infinite; transform-origin: bottom left; }
@keyframes hlPlaneMini { 0%,100% { transform: translateX(0); } 50% { transform: translateX(4px); } }
.hl-planeMini { display: inline-block; animation: hlPlaneMini 2.4s ease-in-out infinite; }
@keyframes hlFly {
  0%   { transform: translate(30px,66px) rotate(24deg); }
  50%  { transform: translate(160px,10px) rotate(0deg); }
  100% { transform: translate(290px,66px) rotate(-24deg); }
}
.hl-fly { animation: hlFly 9s ease-in-out infinite; }
@keyframes hlTw { 0%,100% { opacity: .2; } 50% { opacity: .85; } }
.hl-tw { animation: hlTw 3s ease-in-out infinite; }
.hl-tw2 { animation: hlTw 4.2s ease-in-out infinite; animation-delay: 1s; }
@keyframes hlPop { 0% { transform: scale(.4); opacity: 0; } 60% { transform: scale(1.15); } 100% { transform: scale(1); opacity: 1; } }
.hl-pop { animation: hlPop .5s cubic-bezier(.2,.8,.2,1); }
.hl-cta:hover { transform: translateY(-1px); }
`;
