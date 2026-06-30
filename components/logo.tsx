/**
 * Фирменный логотип Pulse: знак-пульс (кардиограмма) на зелёном градиенте + слово.
 * Векторный (SVG) — не пикселит, используется в логине, портале и как favicon (app/icon.svg).
 */

export function LogoMark({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="pulse-grad" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor="#10b981" />
          <stop offset="1" stopColor="#059669" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="11" fill="url(#pulse-grad)" />
      <path
        d="M6 21.5 H13 L16 12.5 L21.5 28.5 L24.5 20 H34"
        stroke="white"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Logo({
  size = "md",
  markOnly = false,
}: {
  size?: "sm" | "md" | "lg";
  markOnly?: boolean;
}) {
  const mark = size === "lg" ? "h-12 w-12" : size === "sm" ? "h-8 w-8" : "h-9 w-9";
  const text = size === "lg" ? "text-2xl" : "text-lg";
  return (
    <div className="flex items-center gap-2.5">
      <span className={`inline-block overflow-hidden rounded-[28%] shadow-soft ${mark}`}>
        <LogoMark className={mark} />
      </span>
      {!markOnly && (
        <span className={`${text} font-bold tracking-tight text-ink`}>Pulse</span>
      )}
    </div>
  );
}
