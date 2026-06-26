import Link from "next/link";
import { Plus } from "lucide-react";

export function CreateProjectCard() {
  return (
    <Link
      href="/projects/new"
      className="group flex min-h-[260px] flex-col items-center justify-center gap-4 rounded-card border-2 border-dashed border-line p-6 text-center transition duration-200 hover:border-brand hover:bg-brand-soft/40"
    >
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand text-white shadow-soft transition group-hover:bg-brand-strong">
        <Plus className="h-7 w-7" strokeWidth={2.5} />
      </span>
      <span className="text-base font-semibold text-ink">Создать проект</span>
      <span className="max-w-[210px] text-sm text-muted">
        Запустить новое независимое рабочее пространство.
      </span>
    </Link>
  );
}
