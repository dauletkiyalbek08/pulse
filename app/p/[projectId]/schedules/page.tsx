import { createClient } from "@/lib/supabase/server";
import { getEffectiveRole, requireAccess } from "@/lib/queries";
import { manageableRoles } from "@/lib/teams";
import { PageHeader } from "@/components/page-header";
import { ScheduleRow } from "@/components/schedule-row";

const DEFAULT_DAYS = [1, 2, 3, 4, 5];

/** "09:00:00" → "09:00" для input type=time. */
function hhmm(t: string | null | undefined): string {
  return (t ?? "09:00").slice(0, 5);
}

export default async function SchedulesPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  await requireAccess(projectId, "schedules");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const role = await getEffectiveRole(projectId);
  const manageable = manageableRoles(role);

  const { data: members } = await supabase
    .from("project_members")
    .select("user_id, role")
    .eq("project_id", projectId)
    .eq("status", "active");

  const team = (members ?? [])
    .filter((m) => m.user_id !== user?.id)
    .filter((m) => manageable === "all" || manageable.includes(m.role));

  const ids = team.map((m) => m.user_id);
  const [{ data: profiles }, { data: schedules }] = await Promise.all([
    ids.length
      ? supabase.from("profiles").select("id, full_name").in("id", ids)
      : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
    supabase
      .from("work_schedules")
      .select("user_id, days, start_time, end_time")
      .eq("project_id", projectId),
  ]);
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
  const schedById = new Map((schedules ?? []).map((s) => [s.user_id, s]));

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <PageHeader
        title="Графики работы"
        subtitle="Назначайте смены своей команде"
      />

      {team.length === 0 ? (
        <div className="rounded-card border border-dashed border-line bg-surface px-6 py-12 text-center text-sm text-muted">
          В вашей команде пока нет сотрудников.
        </div>
      ) : (
        <div className="space-y-3">
          {team.map((m) => {
            const sched = schedById.get(m.user_id);
            return (
              <ScheduleRow
                key={m.user_id}
                projectId={projectId}
                userId={m.user_id}
                name={nameById.get(m.user_id) ?? "—"}
                role={m.role}
                initialDays={sched?.days ?? DEFAULT_DAYS}
                initialStart={hhmm(sched?.start_time)}
                initialEnd={hhmm(sched?.end_time)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
