import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { Tables } from "@/lib/database.types";
import { getProjectIcon } from "@/components/icons";
import { StatusBadge } from "@/components/status-badge";
import { getProjectStatusMeta } from "@/lib/projects";

export function ProjectCard({ project }: { project: Tables<"projects"> }) {
  const Icon = getProjectIcon(project.icon);
  const status = getProjectStatusMeta(project.status);
  const accent = project.accent_color ?? "#10b981";

  return (
    <Link
      href={`/p/${project.id}`}
      className="group flex min-h-[260px] flex-col rounded-card bg-surface p-6 shadow-card ring-1 ring-line transition duration-200 hover:-translate-y-0.5 hover:shadow-lg"
    >
      <div className="flex items-start justify-between">
        <span
          className="flex h-12 w-12 items-center justify-center rounded-tile"
          style={{ backgroundColor: `${accent}1a`, color: accent }}
        >
          <Icon className="h-6 w-6" />
        </span>
        <StatusBadge tone={status.tone} label={status.label} />
      </div>

      <h3 className="mt-5 text-lg font-semibold text-ink">{project.name}</h3>
      {project.director_name && (
        <p className="mt-1 text-sm text-muted">Директор: {project.director_name}</p>
      )}
      {project.description && (
        <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-faint">
          {project.description}
        </p>
      )}

      <span className="mt-auto inline-flex items-center gap-1.5 pt-5 text-sm font-semibold text-brand">
        Открыть проект
        <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}
