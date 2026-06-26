import { createClient } from "@/lib/supabase/server";
import { getProject, requireAccess } from "@/lib/queries";
import { getNiche } from "@/lib/niches";
import { getCohortFunnel } from "@/lib/funnel";
import { rangeFromSearchParams, rangeEndExclusive } from "@/lib/date-range";
import { formatNumber } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { DateRangePicker } from "@/components/date-range-picker";
import { NewLeadForm } from "@/components/new-lead-form";
import { LeadsTable, type LeadRow } from "@/components/leads-table";

export default async function LeadsPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { projectId } = await params;
  await requireAccess(projectId, "leads");
  const range = rangeFromSearchParams(await searchParams);

  const supabase = await createClient();
  const project = await getProject(projectId);
  const niche = getNiche(project?.niche);

  const [{ data: leads }, funnel] = await Promise.all([
    supabase
      .from("leads")
      .select("id, full_name, phone, source, status, assigned_to, value, created_at")
      .eq("project_id", projectId)
      .gte("created_at", range.from)
      .lt("created_at", rangeEndExclusive(range))
      .order("created_at", { ascending: false }),
    getCohortFunnel(projectId, niche.key, range),
  ]);
  const leadRows = leads ?? [];

  const assigneeIds = [
    ...new Set(leadRows.map((l) => l.assigned_to).filter(Boolean)),
  ] as string[];
  const { data: profiles } = assigneeIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", assigneeIds)
    : { data: [] };
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

  const rows: LeadRow[] = leadRows.map((l) => ({
    id: l.id,
    full_name: l.full_name,
    phone: l.phone,
    source: l.source,
    status: l.status,
    value: l.value,
    created_at: l.created_at,
    assigneeName: l.assigned_to ? nameById.get(l.assigned_to) ?? null : null,
  }));

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <PageHeader title="Лиды" subtitle={`Период: ${range.label}`}>
        <DateRangePicker
          preset={range.preset}
          from={range.from}
          to={range.to}
          label={range.label}
        />
      </PageHeader>

      <div className="mb-6 flex flex-wrap gap-2.5">
        {funnel.map((step) => (
          <div
            key={step.label}
            className="rounded-xl bg-surface px-4 py-2.5 shadow-soft ring-1 ring-line"
          >
            <div className="text-xs text-muted">{step.label}</div>
            <div className="mt-0.5 text-lg font-bold text-ink">
              {formatNumber(step.value)}
            </div>
          </div>
        ))}
      </div>

      <div className="mb-4">
        <NewLeadForm projectId={projectId} />
      </div>

      <LeadsTable rows={rows} niche={niche.key} />
    </div>
  );
}
