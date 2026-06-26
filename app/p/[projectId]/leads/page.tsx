import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getNiche } from "@/lib/niches";
import { PageHeader } from "@/components/page-header";
import { NewLeadForm } from "@/components/new-lead-form";
import { LeadsTable, type LeadRow } from "@/components/leads-table";

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
      <PageHeader title="Лиды" subtitle={`CRM · ${rows.length} лидов`} />

      <div className="mb-4">
        <NewLeadForm projectId={projectId} />
      </div>

      <LeadsTable rows={rows} niche={niche.key} />
    </div>
  );
}
