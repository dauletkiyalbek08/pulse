import { createClient } from "@/lib/supabase/server";
import { getProject, requireAccess } from "@/lib/queries";
import { getNiche } from "@/lib/niches";
import { roleLabel } from "@/lib/members";
import { rangeFromSearchParams, rangeEndExclusive } from "@/lib/date-range";
import { formatNumber, formatCurrencyShort } from "@/lib/format";
import { localDate } from "@/lib/attendance";
import { PageHeader } from "@/components/page-header";
import { DateRangePicker } from "@/components/date-range-picker";
import { Avatar } from "@/components/avatar";
import { Pill } from "@/components/pill";

interface LeadAgg {
  leads: number;
  qualified: number;
  trials: number;
  paid: number;
}
interface SaleAgg {
  count: number;
  revenue: number;
}

/**
 * Команда: сотрудники проекта и их показатели за период.
 * Хантеры — по лидам (когорта), менеджеры — по продажам/выручке.
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
  const project = await getProject(projectId);
  const niche = getNiche(project?.niche);
  const isEducation = niche.key !== "ecommerce";

  const [{ data: members }, { data: openShifts }, { data: leads }, { data: sales }] =
    await Promise.all([
      supabase
        .from("project_members")
        .select("user_id, role, status, hired_at, fired_at")
        .eq("project_id", projectId)
        .order("hired_at", { ascending: true }),
      supabase.from("shifts").select("user_id").eq("project_id", projectId).eq("status", "open"),
      supabase
        .from("leads")
        .select("assigned_to, status")
        .eq("project_id", projectId)
        .gte("created_at", range.from)
        .lt("created_at", rangeEndExclusive(range)),
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

  // Агрегаты по лидам (хантеры) и продажам (менеджеры)
  const leadAgg = new Map<string, LeadAgg>();
  for (const l of leads ?? []) {
    if (!l.assigned_to) continue;
    const a = leadAgg.get(l.assigned_to) ?? { leads: 0, qualified: 0, trials: 0, paid: 0 };
    a.leads += 1;
    if (l.status !== "new" && l.status !== "lost") a.qualified += 1;
    if (["trial", "trial_done", "paid"].includes(l.status)) a.trials += 1;
    if (l.status === "paid") a.paid += 1;
    leadAgg.set(l.assigned_to, a);
  }
  const saleAgg = new Map<string, SaleAgg>();
  for (const s of sales ?? []) {
    if (!s.manager_id) continue;
    const a = saleAgg.get(s.manager_id) ?? { count: 0, revenue: 0 };
    a.count += 1;
    a.revenue += Number(s.amount);
    saleAgg.set(s.manager_id, a);
  }

  const active = team.filter((m) => m.status !== "fired");
  const fired = team.filter((m) => m.status === "fired");

  function Card({ m }: { m: (typeof team)[number] }) {
    const name = nameById.get(m.user_id) ?? "—";
    const la = leadAgg.get(m.user_id);
    const sa = saleAgg.get(m.user_id);
    const isFired = m.status === "fired";
    return (
      <div className="rounded-card bg-surface p-5 shadow-soft ring-1 ring-line">
        <div className="flex items-center gap-3">
          <Avatar name={name} />
          <div className="min-w-0 flex-1">
            <div className="truncate font-semibold text-ink">{name}</div>
            <div className="text-xs text-muted">{roleLabel(m.role)}</div>
          </div>
          {isFired ? (
            <Pill tone="danger">Уволен</Pill>
          ) : onShift.has(m.user_id) ? (
            <Pill tone="success">На смене</Pill>
          ) : null}
        </div>

        {m.role === "hunter" ? (
          <div className={`mt-4 grid gap-2 ${isEducation ? "grid-cols-4" : "grid-cols-3"}`}>
            <Stat label="Лиды" value={formatNumber(la?.leads ?? 0)} />
            <Stat label="Квалиф." value={formatNumber(la?.qualified ?? 0)} />
            {isEducation && <Stat label="Пробные" value={formatNumber(la?.trials ?? 0)} />}
            <Stat label="Оплат." value={formatNumber(la?.paid ?? 0)} />
          </div>
        ) : m.role === "manager" ? (
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Stat label="Продажи" value={formatNumber(sa?.count ?? 0)} />
            <Stat label="Выручка" value={formatCurrencyShort(sa?.revenue ?? 0)} />
          </div>
        ) : (
          <div className="mt-4 text-xs text-muted">
            {isFired && m.fired_at
              ? `Уволен ${localDate(m.fired_at)}`
              : `В команде с ${localDate(m.hired_at)}`}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <PageHeader title="Команда" subtitle="Сотрудники проекта и их показатели за период">
        <DateRangePicker preset={range.preset} from={range.from} to={range.to} label={range.label} />
      </PageHeader>

      {team.length === 0 ? (
        <div className="rounded-card border border-dashed border-line bg-surface px-6 py-12 text-center text-sm text-muted">
          В проекте пока нет сотрудников. Добавьте их в разделе «Права доступа».
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {active.map((m) => (
              <Card key={m.user_id} m={m} />
            ))}
          </div>

          {fired.length > 0 && (
            <>
              <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-faint">
                Уволенные · {formatNumber(fired.length)}
              </h2>
              <div className="grid grid-cols-1 gap-4 opacity-70 sm:grid-cols-2 lg:grid-cols-3">
                {fired.map((m) => (
                  <Card key={m.user_id} m={m} />
                ))}
              </div>
            </>
          )}
        </>
      )}
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
