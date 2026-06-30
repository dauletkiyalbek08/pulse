import { createClient } from "@/lib/supabase/server";
import { getProject, requireAccess } from "@/lib/queries";
import { getNiche } from "@/lib/niches";
import { rangeFromSearchParams, rangeEndExclusive } from "@/lib/date-range";
import { PageHeader } from "@/components/page-header";
import { DateRangePicker } from "@/components/date-range-picker";
import { Pill } from "@/components/pill";
import type { PillTone } from "@/lib/leads";
import { formatDateTime } from "@/lib/format";

// Пробные уроки онлайн, проводят менеджеры — статусы под онлайн-формат.
const TRIAL_STATUS: Record<string, { label: string; tone: PillTone }> = {
  scheduled: { label: "Запланирован", tone: "info" },
  attended: { label: "Проведён", tone: "success" },
  no_show: { label: "Не явился", tone: "warning" },
  purchased: { label: "Купил после", tone: "violet" },
};

const STATUS_ORDER = ["scheduled", "attended", "no_show", "purchased"];

export default async function TrialsPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { projectId } = await params;
  await requireAccess(projectId, "trials");
  const range = rangeFromSearchParams(await searchParams);

  const supabase = await createClient();
  const project = await getProject(projectId);
  const niche = getNiche(project?.niche);

  if (niche.key !== "education") {
    return (
      <div className="mx-auto max-w-6xl px-6 py-8">
        <PageHeader title="Пробные уроки" />
        <div className="rounded-card border border-dashed border-line bg-surface px-6 py-16 text-center text-sm text-muted">
          Раздел доступен только для проектов ниши «Образование».
        </div>
      </div>
    );
  }

  const { data: trials } = await supabase
    .from("trials")
    .select("id, full_name, phone, scheduled_at, status, assigned_to")
    .eq("project_id", projectId)
    .gte("scheduled_at", range.from)
    .lt("scheduled_at", rangeEndExclusive(range))
    .order("scheduled_at", { ascending: false });
  const rows = trials ?? [];

  const assigneeIds = [...new Set(rows.map((t) => t.assigned_to).filter(Boolean))] as string[];
  const { data: profiles } = assigneeIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", assigneeIds)
    : { data: [] };
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

  const countByStatus = rows.reduce<Record<string, number>>((acc, t) => {
    acc[t.status] = (acc[t.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <PageHeader
        title="Пробные уроки"
        subtitle={`Период: ${range.label} · записей: ${rows.length}`}
      >
        <DateRangePicker
          preset={range.preset}
          from={range.from}
          to={range.to}
          label={range.label}
        />
      </PageHeader>

      <div className="mb-5 flex flex-wrap gap-2">
        {STATUS_ORDER.map((status) => {
          const meta = TRIAL_STATUS[status];
          return (
            <span
              key={status}
              className="inline-flex items-center gap-2 rounded-full bg-surface px-3 py-1.5 text-sm shadow-soft ring-1 ring-line"
            >
              <Pill tone={meta.tone}>{meta.label}</Pill>
              <span className="font-semibold text-ink">{countByStatus[status] ?? 0}</span>
            </span>
          );
        })}
      </div>

      {rows.length === 0 ? (
        <div className="rounded-card border border-dashed border-line bg-surface px-6 py-16 text-center text-sm text-muted">
          Записей на пробные уроки пока нет.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-card bg-surface shadow-soft ring-1 ring-line">
          <table className="w-full min-w-[680px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-faint">
                <th className="px-5 py-3 font-medium">Клиент</th>
                <th className="px-5 py-3 font-medium">Телефон</th>
                <th className="px-5 py-3 font-medium">Дата и время</th>
                <th className="px-5 py-3 font-medium">Статус</th>
                <th className="px-5 py-3 font-medium">Ответственный</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((trial) => {
                const meta = TRIAL_STATUS[trial.status] ?? {
                  label: trial.status,
                  tone: "neutral" as PillTone,
                };
                return (
                  <tr
                    key={trial.id}
                    className="border-b border-line last:border-0 transition hover:bg-canvas"
                  >
                    <td className="px-5 py-3 font-medium text-ink">{trial.full_name}</td>
                    <td className="px-5 py-3 text-muted">{trial.phone ?? "—"}</td>
                    <td className="px-5 py-3 text-muted">
                      {trial.scheduled_at ? formatDateTime(trial.scheduled_at) : "—"}
                    </td>
                    <td className="px-5 py-3">
                      <Pill tone={meta.tone}>{meta.label}</Pill>
                    </td>
                    <td className="px-5 py-3 text-muted">
                      {trial.assigned_to ? nameById.get(trial.assigned_to) ?? "—" : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
