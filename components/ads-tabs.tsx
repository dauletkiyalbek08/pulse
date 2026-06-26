"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";

const TABS: { key: string; label: string }[] = [
  { key: "campaign", label: "Кампании" },
  { key: "adset", label: "Группы объявлений" },
  { key: "ad", label: "Объявления" },
];

/** Вкладки уровня Ads Manager. Состояние в URL ?level=campaign|adset|ad. */
export function AdsTabs({ level }: { level: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function pick(key: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("level", key);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="inline-flex rounded-xl border border-line bg-surface p-1 shadow-soft">
      {TABS.map((t) => {
        const active = level === t.key;
        return (
          <button
            key={t.key}
            type="button"
            onClick={() => pick(t.key)}
            className={`rounded-lg px-3.5 py-1.5 text-sm font-medium transition ${
              active ? "bg-brand text-white" : "text-muted hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
