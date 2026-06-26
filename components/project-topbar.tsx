import { LogOut } from "lucide-react";
import { signOut } from "@/app/actions";
import { Avatar } from "@/components/avatar";
import { MobileMenu } from "@/components/mobile-menu";
import { roleLabel } from "@/lib/members";
import type { MenuSection } from "@/lib/menu";

interface ProjectTopbarProps {
  projectName: string;
  nicheLabel: string;
  accent: string;
  icon: string | null;
  projectId: string;
  sections: MenuSection[];
  user: { name: string; role: string };
}

export function ProjectTopbar({
  projectName,
  nicheLabel,
  accent,
  icon,
  projectId,
  sections,
  user,
}: ProjectTopbarProps) {
  return (
    <header className="sticky top-0 z-10 border-b border-line bg-surface/80 backdrop-blur">
      <div className="flex items-center gap-4 px-6 py-3">
        <MobileMenu
          projectId={projectId}
          projectName={projectName}
          nicheLabel={nicheLabel}
          accent={accent}
          icon={icon}
          sections={sections}
        />
        <div className="hidden text-sm lg:block">
          <span className="font-medium text-ink">{projectName}</span>
        </div>
        <div className="text-sm font-medium text-ink lg:hidden">{projectName}</div>

        <div className="ml-auto flex items-center gap-3">
          <div className="hidden text-right sm:block">
            <div className="text-sm font-semibold text-ink">{user.name}</div>
            <div className="text-xs text-muted">{roleLabel(user.role)}</div>
          </div>
          <Avatar name={user.name} />
          <form action={signOut}>
            <button
              type="submit"
              title="Выйти"
              className="flex h-9 w-9 items-center justify-center rounded-full text-muted transition hover:bg-canvas hover:text-ink"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
