import { Construction } from "lucide-react";
import { labelForSegment } from "@/lib/menu";
import { requireAccess } from "@/lib/queries";

/** Заглушка для разделов меню, до которых ещё не дошли (ТЗ, раздел 8). */
export default async function SectionPlaceholder({
  params,
}: {
  params: Promise<{ projectId: string; section: string[] }>;
}) {
  const { projectId, section } = await params;
  const segment = section?.[0] ?? "";
  await requireAccess(projectId, segment);
  const label = labelForSegment(segment);

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <h1 className="text-2xl font-bold tracking-tight text-ink">{label}</h1>
      <div className="mt-8 flex flex-col items-center justify-center rounded-card border border-dashed border-line bg-surface px-6 py-16 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-soft text-brand-ink">
          <Construction className="h-6 w-6" />
        </span>
        <h2 className="mt-4 text-lg font-semibold text-ink">Раздел в разработке</h2>
        <p className="mt-2 max-w-md text-sm text-muted">
          «{label}» появится на следующих этапах. Пункт уже есть в меню, доступ и
          изоляция данных проекта работают.
        </p>
      </div>
    </div>
  );
}
