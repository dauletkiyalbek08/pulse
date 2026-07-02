/** Общие визуалы публичных лендингов: анимированный фон и сцена с достопримечательностями.
 *  Ключевые кадры анимаций живут в app/globals.css (классы hl-*). */

/** Звёзды на всём тёмном фоне (заметные, мерцают). */
const STARS: { x: number; y: number; s: number; d: string }[] = [
  { x: 8, y: 10, s: 2, d: "hl-tw" },
  { x: 18, y: 26, s: 1.5, d: "hl-tw2" },
  { x: 27, y: 8, s: 2.5, d: "hl-tw" },
  { x: 34, y: 20, s: 1.5, d: "hl-tw2" },
  { x: 44, y: 6, s: 2, d: "hl-tw" },
  { x: 52, y: 16, s: 1.5, d: "hl-tw2" },
  { x: 62, y: 9, s: 2.5, d: "hl-tw" },
  { x: 71, y: 22, s: 1.5, d: "hl-tw2" },
  { x: 80, y: 7, s: 2, d: "hl-tw" },
  { x: 89, y: 18, s: 1.5, d: "hl-tw2" },
  { x: 94, y: 32, s: 2, d: "hl-tw" },
  { x: 6, y: 40, s: 1.5, d: "hl-tw2" },
  { x: 15, y: 55, s: 2, d: "hl-tw" },
  { x: 88, y: 48, s: 2, d: "hl-tw2" },
  { x: 96, y: 62, s: 1.5, d: "hl-tw" },
  { x: 4, y: 68, s: 2, d: "hl-tw2" },
  { x: 12, y: 82, s: 1.5, d: "hl-tw" },
  { x: 92, y: 80, s: 2, d: "hl-tw2" },
  { x: 82, y: 92, s: 1.5, d: "hl-tw" },
  { x: 22, y: 92, s: 2, d: "hl-tw2" },
];

export function Starfield() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {STARS.map((st, i) => (
        <span
          key={i}
          className={`${st.d} absolute rounded-full bg-white`}
          style={{
            left: `${st.x}%`,
            top: `${st.y}%`,
            width: `${st.s}px`,
            height: `${st.s}px`,
            boxShadow: "0 0 6px 1px rgba(255,255,255,0.8)",
            animationDelay: `${(i % 5) * 0.4}s`,
          }}
        />
      ))}
    </div>
  );
}

/** Мягкие светящиеся пятна + звёзды на тёмном фоне (спокойные, не мешают контенту). */
export function LandingBlobs({ accent }: { accent: string }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        className="hl-blob absolute -left-28 -top-28 h-72 w-72 rounded-full opacity-20 blur-3xl"
        style={{ backgroundColor: accent }}
      />
      <div className="hl-blob3 absolute -bottom-24 -right-16 h-72 w-72 rounded-full bg-sky-500 opacity-15 blur-3xl" />
      <Starfield />
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
 * Позиционирование — на внешней группе (transform-атрибут), «парение» — на
 * внутренней (CSS-класс), чтобы одно не перебивало другое.
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
      {/* самолётик (эмодзи — узнаваемый), летит по дуге */}
      <g className="hl-fly">
        <text x="-9" y="6" fontSize="17">✈️</text>
      </g>

      {/* Статуя Свободы (стилизованная) */}
      <g transform="translate(96 34)">
        <g className="hl-float">
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
      </g>

      {/* Биг-Бен (стилизованный) */}
      <g transform="translate(184 26)">
        <g className="hl-float2">
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
      </g>

      {/* земля */}
      <path d="M40 138 h240" stroke="#ffffff" strokeOpacity="0.1" strokeWidth="2" />
    </svg>
  );
}
