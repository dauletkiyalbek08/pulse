import { Target, UserCheck, GraduationCap, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getProject, requireAccess, getEffectiveRole } from "@/lib/queries";
import { getNiche } from "@/lib/niches";
import { rangeFromSearchParams, rangeEndExclusive } from "@/lib/date-range";
import { formatNumber } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { DateRangePicker } from "@/components/date-range-picker";
import { MetricCard } from "@/components/metric-card";
import { ShiftWidget } from "@/components/shift-widget";
import { HunterLeads } from "@/components/hunter-leads";
import type { BoardLead } from "@/components/funnel-board";

/**
 * Hunter-кабинет: рабочий экран хантера — своя смена, лиды в работе и итоги.
 * Хантер видит свои лиды; руководитель (РОП/директор/владелец) — лиды всех хантеров.
 */
export default async function HunterPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { projectId } = await params;
  await requireAccess(projectId, "hunter");
  const range = rangeFromSearchParams(await searchParams);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const uid = user?.id ?? "";

  const [project, role] = await Promise.all([getProject(projectId), getEffectiveRole(projectId)]);
  const niche = getNiche(project?.niche);
  const isHunter = role === "hunter";
  const isEducation = niche.key !== "ecommerce";
  const officeSet = project?.office_lat != null && project?.office_lng != null;

  // Область видимости: хантер — свои лиды; руководитель — лиды всех активных хантеров.
  let hunterIds: string[] = [];
  if (!isHunter) {
    const { data: hunters } = await supabase
      .from("project_members")
      .select("user_id")
      .eq("project_id", projectId)
      .eq("role", "hunter")
      .eq("status", "active");
    hunterIds = (hunters ?? []).map((h) => h.user_id);
  }
  const ids = hunterIds.length ? hunterIds : ["-"];
  const activeStatuses = ["new", "assigned", "trial", "trial_done", "processed"];

  const statBase = supabase
    .from("leads")
    .select("status")
    .eq("project_id", projectId)
    .gte("created_at", range.from)
    .lt("created_at", rangeEndExclusive(range));
  const statQuery = isHunter ? statBase.eq("assigned_to", uid) : statBase.in("assigned_to", ids);

  const listBase = supabase
    .from("leads")
    .select("id, full_name, phone, source, status, value, assigned_to, created_at")
    .eq("project_id", projectId)
    .in("status", activeStatuses)
    .order("created_at", { ascending: false })
    .limit(100);
  const listQuery = isHunter ? listBase.eq("assigned_to", uid) : listBase.in("assigned_to", ids);

  const [{ data: openShift }, { data: statLeads }, { data: listLeads }] = await Promise.all([
    supabase
      .from("shifts")
      .select("started_at")
      .eq("project_id", projectId)
      .eq("user_id", uid)
      .eq("status", "open")
      .maybeSingle(),
    statQuery,
    listQuery,
  ]);

  // Когортные итоги за период (по текущему статусу лида)
  const stat = statLeads ?? [];
  const leadsCount = stat.length;
  const qualified = stat.filter((l) => l.status !== "new" && l.status !== "lost").length;
  const trials = stat.filter((l) => ["trial", "trial_done", "paid"].includes(l.status)).length;
  const paid = stat.filter((l) => l.status === "paid").length;

  // Имена ответственных (для обзора руководителя)
  const rows = listLeads ?? [];
  let nameById = new Map<string, string>();
  if (!isHunter) {
    const ids = [...new Set(rows.map((l) => l.assigned_to).filter(Boolean))] as string[];
    const { data: profiles } = ids.length
      ? await supabase.from("profiles").select("id, full_name").in("id", ids)
      : { data: [] };
    nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
  }

  const boardLeads: BoardLead[] = rows.map((l) => ({
    id: l.id,
    full_name: l.full_name,
    phone: l.phone,
    source: l.source,
    status: l.status,
    value: l.value,
    assigneeName: l.assigned_to ? nameById.get(l.assigned_to) ?? null : null,
  }));

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <PageHeader
        title="Hunter-кабинет"
        subtitle={isHunter ? "Ваши лиды и смена" : "Лиды хантеров — обзор и обработка"}
      >
        <DateRangePicker preset={range.preset} from={range.from} to={range.to} label={range.label} />
      </PageHeader>

      {isHunter && (
        <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <ShiftWidget projectId={projectId} openShift={openShift ?? null} officeSet={!!officeSet} />
        </div>
      )}

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard label="Лиды за период" value={formatNumber(leadsCount)} icon={Target} />
        <MetricCard label="Квалифицировано" value={formatNumber(qualified)} icon={UserCheck} />
        {isEducation && <MetricCard label="Пробные" value={formatNumber(trials)} icon={GraduationCap} />}
        <MetricCard label="Оплатили" value={formatNumber(paid)} accent icon={CheckCircle2} />
      </div>

      <h2 className="mb-3 text-base font-semibold text-ink">
        Лиды в работе{rows.length > 0 ? ` · ${formatNumber(rows.length)}` : ""}
      </h2>
      <HunterLeads projectId={projectId} niche={niche.key} leads={boardLeads} showAssignee={!isHunter} />
    </div>
  );
}
