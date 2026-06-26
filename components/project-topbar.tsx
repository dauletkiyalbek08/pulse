import Link from "next/link";
import { ArrowLeft, LogOut } from "lucide-react";
import { signOut } from "@/app/actions";
import { Avatar } from "@/components/avatar";

const ROLE_LABEL: Record<string, string> = {
  owner: "Владелец",
  director: "Директор",
  manager: "Менеджер",
  hunter: "Хантер",
  teacher: "Учитель",
};

interface ProjectTopbarProps {
  projectName: string;
  user: { name: string; role: string };
}

export function ProjectTopbar({ projectName, user }: ProjectTopbarProps) {
  return (
    <header className="sticky top-0 z-10 border-b border-line bg-surface/80 backdrop-blur">
      <div className="flex items-center gap-4 px-6 py-3">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted transition hover:text-ink lg:hidden"
        >
          <ArrowLeft className="h-4 w-4" />
          Проекты
        </Link>
        <div className="hidden text-sm lg:block">
          <Link href="/" className="text-muted transition hover:text-ink">
            Мои проекты
          </Link>
          <span className="px-1.5 text-faint">/</span>
          <span className="font-medium text-ink">{projectName}</span>
        </div>

        <div className="ml-auto flex items-center gap-3">
          <div className="hidden text-right sm:block">
            <div className="text-sm font-semibold text-ink">{user.name}</div>
            <div className="text-xs text-muted">
              {ROLE_LABEL[user.role] ?? user.role}
            </div>
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
