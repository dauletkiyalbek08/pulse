import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getNiche } from "@/lib/niches";
import {
  getLeadStatusMeta,
  leadStatusOrder,
  sourceLabel,
} from "@/lib/leads";
import { Pill } from "@/components/pill";
import { PageHeader } from "@/components/page-header";
import { formatCurrency, formatDate } from "@/lib/format";

export default async function LeadsPage({
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

  const { data: leads } = await supabase
    .from("leads")
    .select("id, full_name, phone, source, status, assigned_to, value, created_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  const rows = leads ?? [];

  const assigneeIds = [
    ...new Set(rows.map((l) => l.assigned_to).filter(Boolean)),
  ] as string[];
  const { data: profiles } = assigneeIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", assigneeIds)
    : { data: [] };
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

  const countByStatus = rows.reduce<Record<string, number>>((acc, l) => {
    acc[l.status] = (acc[l.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <PageHeader title="Лиды" subtitle={`Всего лидов: ${rows.length}`} />

      {/* Сводка по статусам */}
      <div className="mb-5 flex flex-wrap gap-2">
        {leadStatusOrder(niche.key).map((status) => {
          const meta = getLeadStatusMeta(niche.key, status);
          return (
            <span
              key={status}
              className="inline-flex items-center gap-2 rounded-full bg-surface px-3 py-1.5 text-sm shadow-soft ring-1 ring-line"
            >
              <Pill tone={meta.tone}>{meta.label}</Pill>
              <span className="font-semibold text-ink">
                {countByStatus[status] ?? 0}
              </span>
            </span>
          );
        })}
      </div>

      {rows.length === 0 ? (
        <div className="rounded-card border border-dashed border-line bg-surface px-6 py-16 text-center text-sm text-muted">
          Лидов пока нет.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-card bg-surface shadow-soft ring-1 ring-line">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-faint">
                <th className="px-5 py-3 font-medium">Имя</th>
                <th className="px-5 py-3 font-medium">Телефон</th>
                <th className="px-5 py-3 font-medium">Источник</th>
                <th className="px-5 py-3 font-medium">Статус</th>
                <th className="px-5 py-3 font-medium">Ответственный</th>
                <th className="px-5 py-3 text-right font-medium">Сумма</th>
                <th className="px-5 py-3 font-medium">Дата</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((lead) => {
                const meta = getLeadStatusMeta(niche.key, lead.status);
                return (
                  <tr
                    key={lead.id}
                    className="border-b border-line last:border-0 transition hover:bg-canvas"
                  >
                    <td className="px-5 py-3 font-medium text-ink">
                      {lead.full_name}
                    </td>
                    <td className="px-5 py-3 text-muted">{lead.phone ?? "—"}</td>
                    <td className="px-5 py-3 text-muted">
                      {sourceLabel(lead.source)}
                    </td>
                    <td className="px-5 py-3">
                      <Pill tone={meta.tone}>{meta.label}</Pill>
                    </td>
                    <td className="px-5 py-3 text-muted">
                      {lead.assigned_to ? nameById.get(lead.assigned_to) ?? "—" : "—"}
                    </td>
                    <td className="px-5 py-3 text-right text-ink">
                      {lead.value && Number(lead.value) > 0
                        ? formatCurrency(Number(lead.value))
                        : "—"}
                    </td>
                    <td className="px-5 py-3 text-muted">
                      {formatDate(lead.created_at)}
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
