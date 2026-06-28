"use client";

import { useState } from "react";
import Link from "next/link";
import { Search, LogOut, Settings } from "lucide-react";
import { Logo } from "@/components/logo";
import { ProjectCard } from "@/components/project-card";
import { CreateProjectCard } from "@/components/create-project-card";
import { signOut } from "@/app/actions";
import { roleLabel } from "@/lib/members";
import type { Tables } from "@/lib/database.types";

interface PortalViewProps {
  projects: Tables<"projects">[];
  canCreate?: boolean;
  user: { name: string; role: string; email: string };
}

export function PortalView({ projects, canCreate = false, user }: PortalViewProps) {
  const [query, setQuery] = useState("");

  const q = query.trim().toLowerCase();
  const filtered = q
    ? projects.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.director_name ?? "").toLowerCase().includes(q),
      )
    : projects;

  const initials =
    user.name
      .split(" ")
      .map((s) => s[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "—";

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-line bg-surface/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-6 py-3.5">
          <Logo />

          <div className="relative ml-2 hidden max-w-md flex-1 md:block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Поиск проектов..."
              className="w-full rounded-full border border-line bg-canvas py-2 pl-10 pr-4 text-sm text-ink placeholder:text-faint focus:border-brand focus:bg-surface focus:outline-none"
            />
          </div>

          <div className="ml-auto flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <div className="text-sm font-semibold text-ink">{user.name}</div>
              <div className="text-xs text-muted">{roleLabel(user.role)}</div>
            </div>
            {canCreate && (
              <Link
                href="/settings"
                title="Настройки платформы"
                className="flex h-9 w-9 items-center justify-center rounded-full text-muted transition hover:bg-canvas hover:text-ink"
              >
                <Settings className="h-4 w-4" />
              </Link>
            )}
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-soft text-sm font-semibold text-brand-ink">
              {initials}
            </span>
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

      <main className="mx-auto max-w-6xl px-6 py-10 sm:py-14">
        <h1 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">
          Мои проекты
        </h1>
        <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-muted">
          Выберите проект, чтобы открыть его рабочее пространство — каждый проект
          независим и со своими данными.
        </p>

        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
          {q === "" && canCreate && <CreateProjectCard />}
        </div>

        {q !== "" && filtered.length === 0 && (
          <p className="mt-12 text-center text-sm text-muted">
            По запросу «{query}» проектов не найдено.
          </p>
        )}
      </main>
    </div>
  );
}
