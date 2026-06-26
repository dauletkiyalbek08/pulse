import Link from "next/link";
import { Logo } from "@/components/logo";
import { getProjectIcon } from "@/components/icons";
import { SidebarNav } from "@/components/sidebar-nav";
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

      <SidebarNav projectId={projectId} sections={sections} />
    </aside>
  );
}
