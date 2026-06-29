import { requireAccess } from "@/lib/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import { PageHeader } from "@/components/page-header";
import {
  ContractsView,
  type TemplateRow,
  type DocumentRow,
  type EmployeeOpt,
} from "@/components/contracts-view";

export const dynamic = "force-dynamic";

export default async function ContractsPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  await requireAccess(projectId, "contracts");

  const admin = createAdminClient();
  const [{ data: tpls }, { data: docs }, { data: members }] = await Promise.all([
    admin
      .from("document_templates")
      .select("id, name, category, body, is_sample")
      .eq("project_id", projectId)
      .order("created_at", { ascending: true }),
    admin
      .from("documents")
      .select("id, title, category, body, employee_id, status, created_at")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false }),
    admin
      .from("project_members")
      .select("user_id")
      .eq("project_id", projectId)
      .eq("status", "active"),
  ]);

  const memberIds = (members ?? []).map((m) => m.user_id);
  const docEmpIds = (docs ?? []).map((d) => d.employee_id).filter(Boolean) as string[];
  const allIds = [...new Set([...memberIds, ...docEmpIds])];
  const { data: profiles } = allIds.length
    ? await admin.from("profiles").select("id, full_name").in("id", allIds)
    : { data: [] };
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

  const templates: TemplateRow[] = (tpls ?? []) as TemplateRow[];
  const employees: EmployeeOpt[] = memberIds
    .map((id) => ({ id, name: nameById.get(id) ?? "—" }))
    .sort((a, b) => a.name.localeCompare(b.name, "ru"));
  const documents: DocumentRow[] = (docs ?? []).map((d) => ({
    id: d.id,
    title: d.title,
    category: d.category,
    body: d.body,
    status: d.status,
    created_at: d.created_at,
    employeeName: d.employee_id ? nameById.get(d.employee_id) ?? null : null,
  }));

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <PageHeader title="Договоры и документы" subtitle="Шаблоны и заполненные документы по сотрудникам и клиентам" />
      <ContractsView projectId={projectId} templates={templates} documents={documents} employees={employees} />
    </div>
  );
}
