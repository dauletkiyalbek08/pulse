import { Users, MapPin, Clock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getProject, getEffectiveRole, requireAccess } from "@/lib/queries";
import { roleLabel } from "@/lib/members";
import { formatDistance } from "@/lib/geo";
import { formatDateTime, formatNumber } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { Pill } from "@/components/pill";
import { Avatar } from "@/components/avatar";
import { ShiftWidget } from "@/components/shift-widget";
import { OfficeSetup } from "@/components/office-setup";

const MANAGER_ROLES = ["owner", "director", "head_sales"];

function startOfTodayISO(): string {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())).toISOString();
}

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

  const [project, role] = await Promise.all([
    getProject(projectId),
    getEffectiveRole(projectId),
  ]);
  const canManage = !!role && MANAGER_ROLES.includes(role);
  const officeSet = project?.office_lat != null && project?.office_lng != null;

  // Моя открытая смена
  const { data: openShift } = await supabase
    .from("shifts")
    .select("started_at")
    .eq("project_id", projectId)
    .eq("user_id", user?.id ?? "")
    .eq("status", "open")
    .maybeSingle();

  // Смены за сегодня: команда (для управляющих) или только свои
  let query = supabase
    .from("shifts")
    .select("id, user_id, started_at, ended_at, status, start_distance_m")
    .eq("project_id", projectId)
    .gte("started_at", startOfTodayISO())
    .order("started_at", { ascending: false });
  if (!canManage) query = query.eq("user_id", user?.id ?? "");
  const { data: shifts } = await query;
  const rows = shifts ?? [];

  const ids = [...new Set(rows.map((s) => s.user_id))];
  const { data: profiles } = ids.length
    ? await supabase.from("profiles").select("id, full_name").in("id", ids)
    : { data: [] };
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

  const onShiftNow = rows.filter((s) => s.status === "open").length;

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <PageHeader
        title="Посещаемость"
        subtitle={canManage ? "Смены команды и настройка офиса" : "Ваши смены"}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ShiftWidget
          projectId={projectId}
          openShift={openShift ?? null}
          officeSet={!!officeSet}
        />

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
              <MapPin className="h-5 w-5 text-muted" />
              Офис
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
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div className="rounded-card bg-surface p-5 shadow-soft ring-1 ring-line">
            <div className="flex items-center gap-2 text-xs text-muted">
              <Users className="h-4 w-4" /> Сейчас на смене
            </div>
            <div className="mt-1.5 text-2xl font-bold text-brand-ink">
              {formatNumber(onShiftNow)}
            </div>
          </div>
          <div className="rounded-card bg-surface p-5 shadow-soft ring-1 ring-line">
            <div className="flex items-center gap-2 text-xs text-muted">
              <Clock className="h-4 w-4" /> Смен сегодня
            </div>
            <div className="mt-1.5 text-2xl font-bold text-ink">
              {formatNumber(rows.length)}
            </div>
          </div>
        </div>
      )}

      <h2 className="mb-3 mt-8 text-base font-semibold text-ink">
        Смены сегодня
      </h2>
      {rows.length === 0 ? (
        <div className="rounded-card border border-dashed border-line bg-surface px-6 py-12 text-center text-sm text-muted">
          Сегодня смен пока нет.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-card bg-surface shadow-soft ring-1 ring-line">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-faint">
                <th className="px-5 py-3 font-medium">Сотрудник</th>
                <th className="px-5 py-3 font-medium">Начало</th>
                <th className="px-5 py-3 font-medium">Конец</th>
                <th className="px-5 py-3 font-medium">Статус</th>
                <th className="px-5 py-3 text-right font-medium">От офиса</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => {
                const name = nameById.get(s.user_id) ?? "—";
                return (
                  <tr
                    key={s.id}
                    className="border-b border-line last:border-0 transition hover:bg-canvas"
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={name} size="sm" />
                        <span className="font-medium text-ink">{name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-muted">{formatDateTime(s.started_at)}</td>
                    <td className="px-5 py-3 text-muted">
                      {s.ended_at ? formatDateTime(s.ended_at) : "—"}
                    </td>
                    <td className="px-5 py-3">
                      {s.status === "open" ? (
                        <Pill tone="success">На смене</Pill>
                      ) : (
                        <Pill tone="neutral">Завершена</Pill>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right text-muted">
                      {s.start_distance_m != null
                        ? formatDistance(Number(s.start_distance_m))
                        : "—"}
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
