import { createClient } from "@/lib/supabase/server";
import { getProject, requireAccess } from "@/lib/queries";
import { getNiche } from "@/lib/niches";
import { rangeFromSearchParams, rangeEndExclusive } from "@/lib/date-range";
import { getLeadStatusMeta, leadStatusOrder, sourceLabel } from "@/lib/leads";
import type { PillTone } from "@/lib/leads";
import { PageHeader } from "@/components/page-header";
import { DateRangePicker } from "@/components/date-range-picker";
import { Avatar } from "@/components/avatar";
import { formatCurrency } from "@/lib/format";

const NEXT_STEP: Record<string, string> = {
  new: "Связаться и квалифицировать",
  qualified: "Назначить пробный урок",
  trial: "Провести пробный урок",
  processed: "Подтвердить заказ",
  sale: "Сделка закрыта",
};

const DOT: Record<PillTone, string> = {
  neutral: "bg-slate-400",
  info: "bg-blue-500",
  warning: "bg-amber-500",
  violet: "bg-violet-500",
  success: "bg-brand",
};

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

  const { data: leads } = await supabase
    .from("leads")
    .select("id, full_name, source, status, value")
    .eq("project_id", projectId)
    .gte("created_at", range.from)
    .lt("created_at", rangeEndExclusive(range))
    .order("created_at", { ascending: false });
  const rows = leads ?? [];

  const statuses = leadStatusOrder(niche.key);
  const gridCols = statuses.length === 4 ? "lg:grid-cols-4" : "lg:grid-cols-3";

  const valueOf = (st: string) =>
    rows.filter((l) => l.status === st).reduce((s, l) => s + Number(l.value ?? 0), 0);
  const pipelineTotal = rows.reduce((s, l) => s + Number(l.value ?? 0), 0);
  const closedTotal = valueOf("sale");

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <PageHeader
        title="CRM-воронка"
        subtitle={`${niche.funnel.join(" → ")} · период: ${range.label}`}
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
          Продажи:{" "}
          <span className="font-semibold text-brand-ink">{formatCurrency(closedTotal)}</span>
        </span>
      </div>

      <div className={`grid grid-cols-1 gap-4 sm:grid-cols-2 ${gridCols}`}>
        {statuses.map((status) => {
          const meta = getLeadStatusMeta(niche.key, status);
          const items = rows.filter((l) => l.status === status);
          const colSum = valueOf(status);
          return (
            <div key={status} className="flex flex-col rounded-card bg-canvas p-3">
              <div className="mb-1 flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${DOT[meta.tone]}`} />
                  <span className="text-sm font-medium text-ink">{meta.label}</span>
                </div>
                <span className="rounded-full bg-surface px-2 py-0.5 text-xs font-semibold text-muted ring-1 ring-line">
                  {items.length}
                </span>
              </div>
              <div className="mb-3 px-1 text-xs text-faint">{formatCurrency(colSum)}</div>

              <div className="space-y-2">
                {items.map((lead) => {
                  const value = Number(lead.value ?? 0);
                  return (
                    <div
                      key={lead.id}
                      className="rounded-xl bg-surface p-3 shadow-soft ring-1 ring-line"
                    >
                      <div className="flex items-center gap-2.5">
                        <Avatar name={lead.full_name} size="sm" />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium text-ink">
                            {lead.full_name}
                          </div>
                          <div className="text-xs font-semibold text-ink">
                            {value > 0 ? formatCurrency(value) : "0 ₸"}
                          </div>
                        </div>
                      </div>
                      <div className="mt-2 text-xs text-muted">{NEXT_STEP[status] ?? ""}</div>
                      <div className="mt-1.5 flex items-center gap-1.5 text-xs text-faint">
                        <span className={`h-1.5 w-1.5 rounded-full ${DOT[meta.tone]}`} />
                        {sourceLabel(lead.source)}
                      </div>
                    </div>
                  );
                })}
                {items.length === 0 && (
                  <div className="rounded-xl border border-dashed border-line px-1 py-6 text-center text-xs text-faint">
                    Пусто
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
