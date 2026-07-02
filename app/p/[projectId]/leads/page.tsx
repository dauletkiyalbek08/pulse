import { createClient } from "@/lib/supabase/server";
import { getProject, requireAccess, getEffectiveRole } from "@/lib/queries";
import { getNiche } from "@/lib/niches";
import { getCohortFunnel } from "@/lib/funnel";
import { rangeFromSearchParams, rangeEndExclusive } from "@/lib/date-range";
import { formatNumber, formatDateTime } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { DateRangePicker } from "@/components/date-range-picker";
import { NewLeadForm } from "@/components/new-lead-form";
import { LeadsTable, type LeadRow } from "@/components/leads-table";
import { ExportButton } from "@/components/export-button";
import { DistributeLeadsButton } from "@/components/distribute-leads-button";

const SOURCE_LABEL: Record<string, string> = {
  meta: "Meta",
  facebook: "Meta",
  instagram: "Meta",
  tiktok: "TikTok",
  site: "Сайт/Квиз",
  other: "Другое",
};
const STATUS_LABEL: Record<string, string> = {
  new: "Новый",
  qualified: "Квалифицирован",
  processed: "Обработан",
  trial: "Пробный",
  trial_done: "Пробный пройден",
  assigned: "Назначен",
  paid: "Оплатил",
  sale: "Продажа",
  lost: "Потерян",
};

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
  const role = await getEffectiveRole(projectId);

  // Хантер видит только свои лиды
  let leadsQuery = supabase
    .from("leads")
    .select("id, full_name, phone, source, status, assigned_to, value, created_at, external_id, note")
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

  const [{ data: leads }, funnel] = await Promise.all([
    leadsQuery,
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
    fromMeta: !!l.external_id,
  }));

  // Кто может отмечать покупку (и запускать CAPI): продажи ведут менеджеры/руководство.
  const canSell = ["owner", "director", "head_sales", "manager"].includes(role ?? "");

  // Кто может удалять лиды (тестовые и т.п.): руководство + маркетинг/таргет.
  const canDelete = ["owner", "director", "marketer", "targetologist"].includes(role ?? "");

  // РОП/директор может вручную раздать «зависшие» лиды без хантера.
  const canDistribute = ["owner", "director", "head_sales"].includes(role ?? "");
  let unassignedCount = 0;
  if (canDistribute) {
    const { count } = await supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId)
      .is("assigned_to", null)
      .not("status", "in", "(lost,sale,paid)");
    unassignedCount = count ?? 0;
  }

  // Данные для экспорта в CSV (по текущему периоду; хантер — только свои).
  const exportHeaders = [
    "Дата",
    "Имя",
    "Телефон",
    "Источник",
    "Статус",
    "Ответственный",
    "Сумма",
    "Заметка / Ответы квиза",
  ];
  const exportRows: (string | number)[][] = leadRows.map((l) => [
    formatDateTime(l.created_at),
    l.full_name ?? "",
    l.phone ?? "",
    SOURCE_LABEL[l.source ?? ""] ?? l.source ?? "",
    STATUS_LABEL[l.status] ?? l.status,
    l.assigned_to ? nameById.get(l.assigned_to) ?? "" : "",
    l.value ?? 0,
    (l.note ?? "").replace(/\s*\n\s*/g, " | "),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <PageHeader title="Лиды" subtitle={`Период: ${range.label}`}>
        <div className="flex flex-wrap items-center gap-2">
          {canDistribute && (
            <DistributeLeadsButton projectId={projectId} count={unassignedCount} />
          )}
          <ExportButton
            filename={`leads-${range.from}_${range.to}`}
            headers={exportHeaders}
            rows={exportRows}
            label="Экспорт CSV"
          />
          <DateRangePicker
            preset={range.preset}
            from={range.from}
            to={range.to}
            label={range.label}
          />
        </div>
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

      <LeadsTable rows={rows} niche={niche.key} projectId={projectId} canSell={canSell} canDelete={canDelete} />
    </div>
  );
}
