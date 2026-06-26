import { Users, CheckCircle2, Clock, UserX, MapPin } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getProject, getEffectiveRole, requireAccess } from "@/lib/queries";
import { roleLabel } from "@/lib/members";
import { formatNumber } from "@/lib/format";
import {
  localDate,
  localTime,
  localDay,
  lateness,
  todayIsoWeekday,
} from "@/lib/attendance";
import { PageHeader } from "@/components/page-header";
import { Pill } from "@/components/pill";
import { Avatar } from "@/components/avatar";
import { ShiftWidget } from "@/components/shift-widget";
import { OfficeSetup } from "@/components/office-setup";
import { AttendanceJournal, type JournalRow } from "@/components/attendance-journal";

const MANAGER_ROLES = ["owner", "director", "head_sales"];

export default async function AttendancePage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  await requireAccess(projectId, "attendance");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const uid = user?.id ?? "";

  const [project, role] = await Promise.all([
    getProject(projectId),
    getEffectiveRole(projectId),
  ]);
  const canManage = !!role && MANAGER_ROLES.includes(role);
  const officeSet = project?.office_lat != null && project?.office_lng != null;

  const since = new Date(Date.now() - 14 * 86_400_000).toISOString();

  // Моя открытая смена + смены (команда / свои) + участники + графики
  let shiftsQuery = supabase
    .from("shifts")
    .select("id, user_id, started_at, ended_at, status, start_distance_m")
    .eq("project_id", projectId)
    .gte("started_at", since)
    .order("started_at", { ascending: false });
  if (!canManage) shiftsQuery = shiftsQuery.eq("user_id", uid);

  const [{ data: openShift }, { data: shifts }, { data: members }, { data: scheds }] =
    await Promise.all([
      supabase
        .from("shifts")
        .select("started_at")
        .eq("project_id", projectId)
        .eq("user_id", uid)
        .eq("status", "open")
        .maybeSingle(),
      shiftsQuery,
      supabase
        .from("project_members")
        .select("user_id, role")
        .eq("project_id", projectId)
        .eq("status", "active"),
      supabase
        .from("work_schedules")
        .select("user_id, days, start_time")
        .eq("project_id", projectId),
    ]);

  const shiftRows = shifts ?? [];
  const team = members ?? [];

  // Имена сотрудников
  const ids = [...new Set([...shiftRows.map((s) => s.user_id), ...team.map((m) => m.user_id)])];
  const { data: profiles } = ids.length
    ? await supabase.from("profiles").select("id, full_name").in("id", ids)
    : { data: [] };
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
  const roleById = new Map(team.map((m) => [m.user_id, m.role]));
  const schedStart = new Map((scheds ?? []).map((s) => [s.user_id, s.start_time]));
  const schedDays = new Map((scheds ?? []).map((s) => [s.user_id, s.days]));

  // Журнал
  const journal: JournalRow[] = shiftRows.map((s) => ({
    id: s.id,
    name: nameById.get(s.user_id) ?? "—",
    role: roleById.get(s.user_id) ?? "",
    date: localDate(s.started_at),
    checkIn: localTime(s.started_at),
    checkOut: s.ended_at ? localTime(s.ended_at) : "—",
    status: s.status === "open" ? "open" : lateness(s.started_at, schedStart.get(s.user_id) ?? null),
    distanceM: s.start_distance_m != null ? Number(s.start_distance_m) : null,
  }));

  // Сегодня
  const today = localDay();
  const todayWd = todayIsoWeekday();
  const todayByUser = new Map<string, (typeof shiftRows)[number]>();
  for (const s of shiftRows) {
    if (localDay(s.started_at) === today && !todayByUser.has(s.user_id)) {
      todayByUser.set(s.user_id, s);
    }
  }
  const present = todayByUser.size;
  let lateToday = 0;
  todayByUser.forEach((s) => {
    if (lateness(s.started_at, schedStart.get(s.user_id) ?? null) === "late") lateToday++;
  });
  const onTimeToday = present - lateToday;

  const scheduledToday = team.filter((m) =>
    (schedDays.get(m.user_id) ?? [1, 2, 3, 4, 5]).includes(todayWd),
  );
  const notMarked = scheduledToday.filter((m) => !todayByUser.has(m.user_id));

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <PageHeader
        title="Посещаемость"
        subtitle={canManage ? "Учёт рабочего времени · вся команда · сегодня" : "Ваши смены"}
      />

      {canManage && (
        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="Присутствуют" value={present} icon={Users} tone="ink" />
          <StatCard label="Вовремя" value={onTimeToday} icon={CheckCircle2} tone="brand" />
          <StatCard label="Опоздания" value={lateToday} icon={Clock} tone="ink" />
          <StatCard label="Не отметились" value={notMarked.length} icon={UserX} tone="ink" />
        </div>
      )}

      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ShiftWidget projectId={projectId} openShift={openShift ?? null} officeSet={!!officeSet} />

        {canManage ? (
          <OfficeSetup
            projectId={projectId}
            lat={project?.office_lat ?? null}
            lng={project?.office_lng ?? null}
            radius={project?.office_radius_m ?? 100}
            address={project?.office_address ?? null}
          />
        ) : (
          <div className="rounded-card bg-surface p-6 shadow-soft ring-1 ring-line">
            <div className="flex items-center gap-2 text-sm font-semibold text-ink">
              <MapPin className="h-5 w-5 text-muted" /> Офис
            </div>
            <p className="mt-2 text-sm text-muted">
              {officeSet
                ? `Радиус отметки: ${project?.office_radius_m} м${project?.office_address ? ` · ${project.office_address}` : ""}`
                : "Офис ещё не настроен директором."}
            </p>
          </div>
        )}
      </div>

      {canManage && (
        <div className="mb-6 rounded-card bg-surface p-6 shadow-soft ring-1 ring-line">
          <h2 className="text-base font-semibold text-ink">Сегодня по графику</h2>
          <p className="mb-4 text-sm text-muted">
            Отметились {scheduledToday.length - notMarked.length} из {scheduledToday.length}
          </p>
          {scheduledToday.length === 0 ? (
            <p className="text-sm text-muted">На сегодня по графику никого нет.</p>
          ) : (
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {scheduledToday.map((m) => {
                const shift = todayByUser.get(m.user_id);
                const st = shift
                  ? lateness(shift.started_at, schedStart.get(m.user_id) ?? null)
                  : null;
                const name = nameById.get(m.user_id) ?? "—";
                return (
                  <div
                    key={m.user_id}
                    className="flex items-center gap-2.5 rounded-xl bg-canvas p-3 ring-1 ring-line"
                  >
                    <Avatar name={name} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-ink">{name}</div>
                      <div className="text-xs text-muted">{roleLabel(m.role)}</div>
                    </div>
                    {st === null ? (
                      <Pill tone="neutral">Не отметился</Pill>
                    ) : st === "late" ? (
                      <Pill tone="warning">{localTime(shift!.started_at)}</Pill>
                    ) : (
                      <Pill tone="success">{localTime(shift!.started_at)}</Pill>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <AttendanceJournal rows={journal} />
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  tone: "ink" | "brand";
}) {
  return (
    <div className="rounded-card bg-surface p-5 shadow-soft ring-1 ring-line">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted">{label}</span>
        <Icon className="h-4 w-4 text-faint" />
      </div>
      <div
        className={`mt-2 text-3xl font-bold ${tone === "brand" ? "text-brand-ink" : "text-ink"}`}
      >
        {formatNumber(value)}
      </div>
    </div>
  );
}
