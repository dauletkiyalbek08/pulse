"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/logo";
import { getProjectIcon } from "@/components/icons";
import { SidebarNav } from "@/components/sidebar-nav";
import type { MenuSection } from "@/lib/menu";

interface MobileMenuProps {
  projectId: string;
  projectName: string;
  nicheLabel: string;
  accent: string;
  icon: string | null;
  sections: MenuSection[];
}

/** Кнопка-бургер + выезжающее меню для телефонов (скрыто на десктопе). */
export function MobileMenu({
  projectId,
  projectName,
  nicheLabel,
  accent,
  icon,
  sections,
}: MobileMenuProps) {
  const [open, setOpen] = useState(false);
  const ProjectIcon = getProjectIcon(icon);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Меню"
        className="flex h-9 w-9 items-center justify-center rounded-lg text-muted transition hover:bg-canvas hover:text-ink lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Drawer рендерим в body, чтобы он не попал в стек-контекст шапки (backdrop-blur) */}
      {open &&
        createPortal(
          <div className="fixed inset-0 z-50 lg:hidden">
            <div
              className="absolute inset-0 bg-black/40"
              onClick={() => setOpen(false)}
            />
            <aside className="absolute inset-y-0 left-0 flex w-[280px] max-w-[85%] flex-col bg-surface shadow-card">
              <div className="flex items-center justify-between border-b border-line px-5 py-4">
                <Logo />
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Закрыть"
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition hover:bg-canvas hover:text-ink"
                >
                  <X className="h-5 w-5" />
                </button>
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

              <SidebarNav
                projectId={projectId}
                sections={sections}
                onNavigate={() => setOpen(false)}
              />
            </aside>
          </div>,
          document.body,
        )}
    </>
  );
}
