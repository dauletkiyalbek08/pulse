"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/logo";
import { getProjectIcon, getMenuIcon } from "@/components/icons";
import type { MenuSection } from "@/lib/menu";

interface SidebarProps {
  projectId: string;
  projectName: string;
  nicheLabel: string;
  accent: string;
  icon: string | null;
  sections: MenuSection[];
}

export function Sidebar({
  projectId,
  projectName,
  nicheLabel,
  accent,
  icon,
  sections,
}: SidebarProps) {
  const pathname = usePathname();
  const base = `/p/${projectId}`;
  const ProjectIcon = getProjectIcon(icon);

  return (
    <aside className="fixed inset-y-0 left-0 z-20 hidden w-[260px] flex-col border-r border-line bg-surface lg:flex">
      <div className="border-b border-line px-5 py-4">
        <Link href="/">
          <Logo />
        </Link>
      </div>

      <div className="flex items-center gap-3 border-b border-line px-5 py-4">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-tile"
          style={{ backgroundColor: `${accent}1a`, color: accent }}
        >
          <ProjectIcon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-ink">
            {projectName}
          </div>
          <div className="text-xs text-muted">{nicheLabel}</div>
        </div>
      </div>

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
    </aside>
  );
}
