import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getNiche } from "@/lib/niches";
import { rolesForNiche, roleLabel } from "@/lib/members";
import { PageHeader } from "@/components/page-header";
import { Pill } from "@/components/pill";
import { NewEmployeeForm } from "@/components/new-employee-form";
import { FireMemberForm } from "@/components/fire-member-form";
import { formatDate } from "@/lib/format";

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: project } = await supabase
    .from("projects")
    .select("niche")
    .eq("id", projectId)
    .maybeSingle();
  const niche = getNiche(project?.niche);

  const { data: members } = await supabase
    .from("project_members")
    .select("id, user_id, role, status, hired_at, fired_at")
    .eq("project_id", projectId)
    .order("hired_at", { ascending: true });
  const rows = members ?? [];

  const ids = rows.map((m) => m.user_id);
  const { data: profiles } = ids.length
    ? await supabase.from("profiles").select("id, full_name").in("id", ids)
    : { data: [] };
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

  const active = rows.filter((m) => m.status === "active");
  const fired = rows.filter((m) => m.status === "fired");

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <PageHeader
        title="Настройки · Права доступа"
        subtitle="Сотрудники проекта: создание с логином/паролем, роли, увольнение"
      />

      {/* Добавить сотрудника */}
      <section className="mb-8 rounded-card bg-surface p-6 shadow-soft ring-1 ring-line">
        <h2 className="mb-4 text-base font-semibold text-ink">
          Добавить сотрудника
        </h2>
        <NewEmployeeForm projectId={projectId} roles={rolesForNiche(niche.key)} />
      </section>

      {/* Активные сотрудники */}
      <section className="mb-8">
        <h2 className="mb-4 text-base font-semibold text-ink">
          Сотрудники проекта ({active.length})
        </h2>
        {active.length === 0 ? (
          <div className="rounded-card border border-dashed border-line bg-surface px-6 py-12 text-center text-sm text-muted">
            Пока нет сотрудников. Добавьте первого выше.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-card bg-surface shadow-soft ring-1 ring-line">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-faint">
                  <th className="px-5 py-3 font-medium">Имя</th>
                  <th className="px-5 py-3 font-medium">Роль</th>
                  <th className="px-5 py-3 font-medium">Принят</th>
                  <th className="px-5 py-3 text-right font-medium">Действие</th>
                </tr>
              </thead>
              <tbody>
                {active.map((m) => (
                  <tr
                    key={m.id}
                    className="border-b border-line last:border-0 transition hover:bg-canvas"
                  >
                    <td className="px-5 py-3 font-medium text-ink">
                      {nameById.get(m.user_id) ?? "—"}
                    </td>
                    <td className="px-5 py-3">
                      <Pill tone="info">{roleLabel(m.role)}</Pill>
                    </td>
                    <td className="px-5 py-3 text-muted">
                      {formatDate(m.hired_at)}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end">
                        <FireMemberForm
                          projectId={projectId}
                          memberId={m.id}
                          name={nameById.get(m.user_id) ?? "сотрудник"}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Уволенные */}
      {fired.length > 0 && (
        <section>
          <h2 className="mb-4 text-base font-semibold text-ink">
            Уволенные ({fired.length})
          </h2>
          <ul className="divide-y divide-line rounded-card bg-surface shadow-soft ring-1 ring-line">
            {fired.map((m) => (
              <li
                key={m.id}
                className="flex items-center justify-between px-5 py-3 text-sm"
              >
                <span className="text-muted line-through">
                  {nameById.get(m.user_id) ?? "—"}
                </span>
                <span className="flex items-center gap-3">
                  <Pill tone="neutral">{roleLabel(m.role)}</Pill>
                  <span className="text-xs text-faint">
                    уволен {m.fired_at ? formatDate(m.fired_at) : ""}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
