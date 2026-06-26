"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { getMenuIcon } from "@/components/icons";
import type { MenuSection } from "@/lib/menu";

/** Список разделов меню — общий для десктоп-сайдбара и мобильного drawer. */
export function SidebarNav({
  projectId,
  sections,
  onNavigate,
}: {
  projectId: string;
  sections: MenuSection[];
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const base = `/p/${projectId}`;

  return (
    <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
      {sections.map((section) => (
        <div key={section.title}>
          <div className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-faint">
            {section.title}
          </div>
          <ul className="space-y-0.5">
            {section.items.map((item) => {
              const href = item.segment ? `${base}/${item.segment}` : base;
              const active = item.segment
                ? pathname === href || pathname.startsWith(`${href}/`)
                : pathname === base;
              const Icon = getMenuIcon(item.icon);
              return (
                <li key={item.segment || "home"}>
                  <Link
                    href={href}
                    onClick={onNavigate}
                    className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition ${
                      active
                        ? "bg-brand-soft font-medium text-brand-ink"
                        : "text-muted hover:bg-canvas hover:text-ink"
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
