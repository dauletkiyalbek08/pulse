import { createClient } from "@/lib/supabase/server";
import { getProject, requireAccess, getEffectiveRole } from "@/lib/queries";
import { getNiche } from "@/lib/niches";
import { rangeFromSearchParams, rangeEndExclusive } from "@/lib/date-range";
import { PageHeader } from "@/components/page-header";
import { DateRangePicker } from "@/components/date-range-picker";
import { FunnelBoard, type BoardLead } from "@/components/funnel-board";
import { formatCurrency } from "@/lib/format";

export default async function FunnelPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { projectId } = await params;
  await requireAccess(projectId, "funnel");
  const range = rangeFromSearchParams(await searchParams);

  const supabase = await createClient();
  const project = await getProject(projectId);
  const niche = getNiche(project?.niche);
  const role = await getEffectiveRole(projectId);

  let leadsQuery = supabase
    .from("leads")
    .select("id, full_name, phone, source, status, value, assigned_to, note")
    .eq("project_id", projectId)
    .gte("created_at", range.from)
    .lt("created_at", rangeEndExclusive(range))
    .order("created_at", { ascending: false });
  if (role === "hunter") {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    leadsQuery = leadsQuery.eq("assigned_to", user?.id ?? "");
  }
  const { data: leads } = await leadsQuery;
  const rows = leads ?? [];

  const assigneeIds = [...new Set(rows.map((l) => l.assigned_to).filter(Boolean))] as string[];
  const { data: profiles } = assigneeIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", assigneeIds)
    : { data: [] };
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

  const boardLeads: BoardLead[] = rows.map((l) => ({
    id: l.id,
    full_name: l.full_name,
    phone: l.phone,
    source: l.source,
    status: l.status,
    value: l.value,
    assigneeName: l.assigned_to ? nameById.get(l.assigned_to) ?? null : null,
    note: l.note,
  }));

  const pipelineTotal = rows.reduce((s, l) => s + Number(l.value ?? 0), 0);
  const closedTotal = rows
    .filter((l) => l.status === "paid")
    .reduce((s, l) => s + Number(l.value ?? 0), 0);

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <PageHeader
        title="CRM-воронка"
        subtitle={`Перетаскивайте карточки между этапами · период: ${range.label}`}
      >
        <DateRangePicker
          preset={range.preset}
          from={range.from}
          to={range.to}
          label={range.label}
        />
      </PageHeader>

      <div className="mb-5 flex flex-wrap items-center gap-4 text-sm">
        <span className="text-muted">
          В воронке:{" "}
          <span className="font-semibold text-ink">{formatCurrency(pipelineTotal)}</span>
        </span>
        <span className="text-muted">
          Оплатили:{" "}
          <span className="font-semibold text-brand-ink">{formatCurrency(closedTotal)}</span>
        </span>
      </div>

      <FunnelBoard projectId={projectId} niche={niche.key} leads={boardLeads} />
    </div>
  );
}
