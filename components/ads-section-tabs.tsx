"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { BarChart3, Rocket, Plug } from "lucide-react";

const TABS = [
  { key: "analytics", label: "Аналитика", icon: BarChart3 },
  { key: "launch", label: "Запуск рекламы", icon: Rocket },
  { key: "connections", label: "Подключения", icon: Plug },
] as const;

/** Верхние вкладки раздела «Реклама». Состояние в URL ?tab=analytics|launch|connections. */
export function AdsSectionTabs({ tab }: { tab: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function pick(key: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", key);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="mb-6 flex flex-wrap gap-2 border-b border-line">
      {TABS.map((t) => {
        const active = tab === t.key;
        const Icon = t.icon;
        return (
          <button
            key={t.key}
            type="button"
            onClick={() => pick(t.key)}
            className={`-mb-px inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition ${
              active
                ? "border-brand text-brand-ink"
                : "border-transparent text-muted hover:text-ink"
            }`}
          >
            <Icon className="h-4 w-4" />
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
