import { createClient } from "@/lib/supabase/server";
import { requireAccess } from "@/lib/queries";
import { roleLabel } from "@/lib/members";
import { rangeFromSearchParams, rangeEndExclusive } from "@/lib/date-range";
import { formatNumber, formatPercent, formatCurrencyShort } from "@/lib/format";
import { localDate } from "@/lib/attendance";
import { getCallQuality } from "@/lib/call-quality";
import { PageHeader } from "@/components/page-header";
import { DateRangePicker } from "@/components/date-range-picker";
import { Avatar } from "@/components/avatar";
import { Pill } from "@/components/pill";
import type { PillTone } from "@/lib/leads";

function callTone(s: number): PillTone {
  if (s >= 80) return "success";
  if (s >= 60) return "warning";
  return "danger";
}

interface Metrics {
  trials: number; // проведено пробных уроков
  purchased: number; // купили после урока
  sales: number; // оформлено продаж
  revenue: number; // выручка ₸
}

/**
 * Менеджеры (отдел продаж): уроки, успешные, конверсия, продажи и выручка.
 * Сейчас один отдел продаж; на будущее структуру можно разбить по РОП.
 * Уроки берём из trials (assigned_to = менеджер), продажи — из sales.manager_id.
 */
export default async function TeamPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { projectId } = await params;
  await requireAccess(projectId, "team");
  const range = rangeFromSearchParams(await searchParams);

  const supabase = await createClient();

  const [{ data: members }, { data: openShifts }, { data: trials }, { data: sales }] =
    await Promise.all([
      supabase
        .from("project_members")
        .select("user_id, role, status, hired_at, fired_at")
        .eq("project_id", projectId)
        .in("role", ["manager", "head_sales"])
        .order("hired_at", { ascending: true }),
      supabase.from("shifts").select("user_id").eq("project_id", projectId).eq("status", "open"),
      supabase
        .from("trials")
        .select("assigned_to, status")
        .eq("project_id", projectId)
        .gte("scheduled_at", range.from)
        .lt("scheduled_at", rangeEndExclusive(range)),
      supabase
        .from("sales")
        .select("manager_id, amount")
        .eq("project_id", projectId)
        .gte("created_at", range.from)
        .lt("created_at", rangeEndExclusive(range)),
    ]);

  const team = members ?? [];
  const ids = team.map((m) => m.user_id);
  const { data: profiles } = ids.length
    ? await supabase.from("profiles").select("id, full_name").in("id", ids)
    : { data: [] };
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
  const onShift = new Set((openShifts ?? []).map((s) => s.user_id));

  // Качество звонков за период (из «Анализа звонков»)
  const quality = await getCallQuality(projectId, range.from, rangeEndExclusive(range));
  const callPill = (uid: string) => {
    const q = quality.byEmployee.get(uid);
    return q ? <Pill tone={callTone(q.avg)}>Звонки {q.avg}</Pill> : null;
  };

  // Уроки по менеджеру + итог по отделу
  const tByUser = new Map<string, { trials: number; purchased: number }>();
  const dep: Metrics = { trials: 0, purchased: 0, sales: 0, revenue: 0 };
  for (const t of trials ?? []) {
    dep.trials += 1;
    if (t.status === "purchased") dep.purchased += 1;
    if (!t.assigned_to) continue;
    const a = tByUser.get(t.assigned_to) ?? { trials: 0, purchased: 0 };
    a.trials += 1;
    if (t.status === "purchased") a.purchased += 1;
    tByUser.set(t.assigned_to, a);
  }
  // Продажи по менеджеру + итог по отделу
  const sByUser = new Map<string, { sales: number; revenue: number }>();
  for (const s of sales ?? []) {
    dep.sales += 1;
    dep.revenue += Number(s.amount);
    if (!s.manager_id) continue;
    const a = sByUser.get(s.manager_id) ?? { sales: 0, revenue: 0 };
    a.sales += 1;
    a.revenue += Number(s.amount);
    sByUser.set(s.manager_id, a);
  }

  const metricsFor = (uid: string): Metrics => ({
    trials: tByUser.get(uid)?.trials ?? 0,
    purchased: tByUser.get(uid)?.purchased ?? 0,
    sales: sByUser.get(uid)?.sales ?? 0,
    revenue: sByUser.get(uid)?.revenue ?? 0,
  });

  const managers = team.filter((m) => m.role === "manager");
  const activeManagers = managers.filter((m) => m.status !== "fired");
  const firedManagers = managers.filter((m) => m.status === "fired");
  const rop = team.find((m) => m.role === "head_sales" && m.status !== "fired") ?? null;
  const ropName = rop ? nameById.get(rop.user_id) ?? "—" : null;

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <PageHeader title="Менеджеры" subtitle="Отдел продаж — уроки, продажи и конверсия за период">
        <DateRangePicker preset={range.preset} from={range.from} to={range.to} label={range.label} />
      </PageHeader>

      {/* Сводка по отделу продаж (РОП) */}
      <div className="mb-6 rounded-card border border-brand-soft bg-brand-soft/40 p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs font-medium text-brand-ink">Отдел продаж</div>
            <div className="mt-0.5 font-semibold text-ink">
              {ropName ? `${ropName} · РОП` : "Итого по отделу"}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {quality.count > 0 && <Pill tone={callTone(quality.avg)}>Звонки {quality.avg}</Pill>}
            <span className="text-xs text-muted">{formatNumber(activeManagers.length)} менеджеров</span>
          </div>
        </div>
        <Chips m={dep} />
      </div>

      {managers.length === 0 ? (
        <div className="rounded-card border border-dashed border-line bg-surface px-6 py-12 text-center text-sm text-muted">
          В отделе продаж пока нет менеджеров. Добавьте их в разделе «Права доступа».
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {activeManagers.map((m) => {
              const name = nameById.get(m.user_id) ?? "—";
              return (
                <div key={m.user_id} className="rounded-card bg-surface p-5 shadow-soft ring-1 ring-line">
                  <div className="flex items-center gap-3">
                    <Avatar name={name} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold text-ink">{name}</div>
                      <div className="text-xs text-muted">{roleLabel(m.role)}</div>
                    </div>
                    {callPill(m.user_id)}
                    {onShift.has(m.user_id) && <Pill tone="success">На смене</Pill>}
                  </div>
                  <Chips m={metricsFor(m.user_id)} />
                </div>
              );
            })}
          </div>

          {firedManagers.length > 0 && (
            <>
              <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-faint">
                Уволенные · {formatNumber(firedManagers.length)}
              </h2>
              <div className="grid grid-cols-1 gap-4 opacity-70 md:grid-cols-2">
                {firedManagers.map((m) => {
                  const name = nameById.get(m.user_id) ?? "—";
                  return (
                    <div key={m.user_id} className="rounded-card bg-surface p-5 shadow-soft ring-1 ring-line">
                      <div className="flex items-center gap-3">
                        <Avatar name={name} />
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-semibold text-ink">{name}</div>
                          <div className="text-xs text-muted">
                            {roleLabel(m.role)}
                            {m.fired_at ? ` · уволен ${localDate(m.fired_at)}` : ""}
                          </div>
                        </div>
                        <Pill tone="danger">Уволен</Pill>
                      </div>
                      <Chips m={metricsFor(m.user_id)} />
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

/** Шесть показателей менеджера/отдела: уроки, успешно, конверсия, продажи, выручка, средний чек. */
function Chips({ m }: { m: Metrics }) {
  const conv = m.trials > 0 ? (m.purchased / m.trials) * 100 : null;
  const avg = m.sales > 0 ? m.revenue / m.sales : 0;
  return (
    <div className="mt-4 grid grid-cols-3 gap-2">
      <Stat label="Уроки" value={formatNumber(m.trials)} />
      <Stat label="Успешно" value={formatNumber(m.purchased)} />
      <Stat label="Конверсия" value={conv != null ? formatPercent(conv) : "—"} />
      <Stat label="Продажи" value={formatNumber(m.sales)} />
      <Stat label="Выручка" value={formatCurrencyShort(m.revenue)} />
      <Stat label="Средний чек" value={m.sales > 0 ? formatCurrencyShort(avg) : "—"} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-canvas px-3 py-2">
      <div className="text-[11px] text-muted">{label}</div>
      <div className="mt-0.5 text-sm font-bold text-ink">{value}</div>
    </div>
  );
}
