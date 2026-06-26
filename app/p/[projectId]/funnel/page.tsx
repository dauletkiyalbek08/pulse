import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getNiche } from "@/lib/niches";
import { getLeadStatusMeta, leadStatusOrder, sourceLabel } from "@/lib/leads";
import { PageHeader } from "@/components/page-header";
import { Pill } from "@/components/pill";
import { formatCurrency } from "@/lib/format";

export default async function FunnelPage({
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
    .select("id, full_name, phone, source, status, value")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  const rows = leads ?? [];

  const statuses = leadStatusOrder(niche.key);
  const gridCols = statuses.length === 4 ? "lg:grid-cols-4" : "lg:grid-cols-3";

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <PageHeader
        title="CRM-воронка"
        subtitle={`Воронка: ${niche.funnel.join(" → ")} · перетаскивание добавим позже`}
      />

      <div className={`grid grid-cols-1 gap-4 sm:grid-cols-2 ${gridCols}`}>
        {statuses.map((status) => {
          const meta = getLeadStatusMeta(niche.key, status);
          const items = rows.filter((l) => l.status === status);
          return (
            <div key={status} className="rounded-card bg-canvas p-3">
              <div className="mb-3 flex items-center justify-between px-1">
                <Pill tone={meta.tone}>{meta.label}</Pill>
                <span className="text-sm font-semibold text-ink">{items.length}</span>
              </div>
              <div className="space-y-2">
                {items.map((lead) => (
                  <div
                    key={lead.id}
                    className="rounded-xl bg-surface p-3 shadow-soft ring-1 ring-line"
                  >
                    <div className="text-sm font-medium text-ink">{lead.full_name}</div>
                    <div className="mt-0.5 text-xs text-muted">
                      {(lead.phone ?? "—") + " · " + sourceLabel(lead.source)}
                    </div>
                    {lead.value && Number(lead.value) > 0 ? (
                      <div className="mt-1 text-xs font-semibold text-brand-ink">
                        {formatCurrency(Number(lead.value))}
                      </div>
                    ) : null}
                  </div>
                ))}
                {items.length === 0 && (
                  <div className="px-1 py-6 text-center text-xs text-faint">Пусто</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
