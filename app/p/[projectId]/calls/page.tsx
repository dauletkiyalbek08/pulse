import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAccess, getEffectiveRole } from "@/lib/queries";
import { formatDateTime, formatNumber } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { Pill } from "@/components/pill";
import type { PillTone } from "@/lib/leads";
import { CallAiSettings } from "@/components/call-ai-settings";
import { CallAnalyzeForm, type Employee } from "@/components/call-analyze-form";
import { CallBulkUpload } from "@/components/call-bulk-upload";
import { CallsFilters } from "@/components/calls-filters";
import { CallResultView } from "@/components/call-result-view";
import { getCallAiStatus } from "@/app/p/[projectId]/calls/actions";
import type { CallResult, CriterionScore } from "@/lib/call-analysis";

const MANAGE_ROLES = ["owner", "director", "head_sales"];
const LOW_SCORE = 60; // ниже этого — «худший звонок», на разбор с РОПом

function scoreTone(s: number): PillTone {
  if (s >= 80) return "success";
  if (s >= 60) return "warning";
  return "danger";
}

/** Начало ISO-недели (понедельник) в формате YYYY-MM-DD. */
function weekKey(iso: string): string {
  const d = new Date(iso);
  const day = (d.getUTCDay() + 6) % 7;
  const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day));
  return monday.toISOString().slice(0, 10);
}

interface Row {
  id: string;
  employee_id: string | null;
  role_type: string;
  overall_score: number;
  summary: string | null;
  criteria: unknown;
  strengths: unknown;
  issues: unknown;
  recommendations: unknown;
  source: string;
  created_at: string;
}

function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: PillTone }) {
  const color =
    tone === "success" ? "text-emerald-600" : tone === "danger" ? "text-red-600" : tone === "warning" ? "text-amber-600" : "text-ink";
  return (
    <div className="rounded-card bg-surface p-4 shadow-soft ring-1 ring-line">
      <div className="text-xs text-muted">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${color}`}>{value}</div>
      {hint && <div className="mt-0.5 text-xs text-faint">{hint}</div>}
    </div>
  );
}

export default async function CallsPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { projectId } = await params;
  await requireAccess(projectId, "calls");
  const sp = await searchParams;

  const supabase = await createClient();
  const admin = createAdminClient();
  const role = await getEffectiveRole(projectId);
  const canManage = MANAGE_ROLES.includes(role ?? "");
  const isOwner = role === "owner";

  const status = await getCallAiStatus(projectId);

  // Фильтры
  const emp = typeof sp.emp === "string" ? sp.emp : "";
  const period = sp.period === "7" || sp.period === "all" ? sp.period : "30";
  const since =
    period === "all" ? null : new Date(Date.now() - (period === "7" ? 7 : 30) * 86_400_000).toISOString();

  // Сотрудники для разбора (менеджеры + хантеры)
  const { data: members } = await supabase
    .from("project_members")
    .select("user_id, role")
    .eq("project_id", projectId)
    .in("role", ["manager", "hunter"])
    .eq("status", "active");
  const ids = (members ?? []).map((m) => m.user_id);
  const { data: profiles } = ids.length
    ? await supabase.from("profiles").select("id, full_name").in("id", ids)
    : { data: [] };
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
  const employees: Employee[] = (members ?? [])
    .map((m) => ({ id: m.user_id, name: nameById.get(m.user_id) ?? "—", role: m.role }))
    .sort((a, b) => a.name.localeCompare(b.name, "ru"));

  // Разборы за период (с учётом фильтра по сотруднику)
  let rows: Row[] = [];
  if (status?.connected) {
    let q = admin
      .from("call_analyses")
      .select(
        "id, employee_id, role_type, overall_score, summary, criteria, strengths, issues, recommendations, source, created_at",
      )
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(500);
    if (since) q = q.gte("created_at", since);
    if (emp) q = q.eq("employee_id", emp);
    const { data } = await q;
    rows = (data ?? []) as Row[];
  }

  // Сводка
  const total = rows.length;
  const avg = total ? Math.round(rows.reduce((s, r) => s + Number(r.overall_score), 0) / total) : 0;
  const worst = rows
    .filter((r) => Number(r.overall_score) < LOW_SCORE)
    .sort((a, b) => Number(a.overall_score) - Number(b.overall_score));

  // Качество по сотрудникам
  const byEmp = new Map<string, { sum: number; n: number }>();
  for (const r of rows) {
    if (!r.employee_id) continue;
    const a = byEmp.get(r.employee_id) ?? { sum: 0, n: 0 };
    a.sum += Number(r.overall_score);
    a.n += 1;
    byEmp.set(r.employee_id, a);
  }
  const perEmp = [...byEmp.entries()]
    .map(([id, a]) => ({ id, name: nameById.get(id) ?? "—", avg: Math.round(a.sum / a.n), n: a.n }))
    .sort((a, b) => b.avg - a.avg);
  const best = perEmp[0];

  // Динамика по неделям (до 8 точек)
  const byWeek = new Map<string, { sum: number; n: number }>();
  for (const r of rows) {
    const k = weekKey(r.created_at);
    const a = byWeek.get(k) ?? { sum: 0, n: 0 };
    a.sum += Number(r.overall_score);
    a.n += 1;
    byWeek.set(k, a);
  }
  const trend = [...byWeek.entries()]
    .map(([k, a]) => ({ week: k, avg: Math.round(a.sum / a.n), n: a.n }))
    .sort((a, b) => a.week.localeCompare(b.week))
    .slice(-8);

  const toResult = (r: Row): CallResult => ({
    overall: Number(r.overall_score) || 0,
    criteria: Array.isArray(r.criteria) ? (r.criteria as CriterionScore[]) : [],
    strengths: Array.isArray(r.strengths) ? (r.strengths as string[]) : [],
    issues: Array.isArray(r.issues) ? (r.issues as string[]) : [],
    recommendations: Array.isArray(r.recommendations) ? (r.recommendations as string[]) : [],
    summary: (r.summary as string) ?? "",
  });

  const fmtWeek = (k: string) => {
    const d = new Date(k);
    return `${String(d.getUTCDate()).padStart(2, "0")}.${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  };

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <PageHeader title="Анализ звонков" subtitle="Кабинет РОПа: качество звонков отдела (DeepSeek)" />

      <div className="mb-6">
        <CallAiSettings projectId={projectId} status={status} canManage={canManage} isOwner={isOwner} />
      </div>

      {status?.connected && (
        <>
          {/* Добавление разборов */}
          <div className="mb-6 grid gap-6 lg:grid-cols-2">
            <CallBulkUpload projectId={projectId} employees={employees} asrConnected={status.asrConnected} />
            <CallAnalyzeForm projectId={projectId} employees={employees} asrConnected={status.asrConnected} />
          </div>

          {/* Фильтры */}
          <div className="mb-5">
            <CallsFilters employees={employees} emp={emp} period={period} />
          </div>

          {total === 0 ? (
            <div className="rounded-card border border-dashed border-line bg-surface px-6 py-12 text-center text-sm text-muted">
              За выбранный период разборов нет. Загрузите записи выше или поменяйте период.
            </div>
          ) : (
            <>
              {/* Сводка */}
              <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
                <Stat label="Разборов за период" value={formatNumber(total)} />
                <Stat label="Средний балл" value={`${avg}/100`} tone={scoreTone(avg)} />
                <Stat
                  label="Ниже порога (60)"
                  value={formatNumber(worst.length)}
                  hint="звонки на разбор"
                  tone={worst.length ? "danger" : "success"}
                />
                <Stat
                  label="Лучший сотрудник"
                  value={best ? `${best.avg}/100` : "—"}
                  hint={best ? best.name : undefined}
                  tone={best ? scoreTone(best.avg) : undefined}
                />
              </div>

              <div className="mb-6 grid gap-6 lg:grid-cols-2">
                {/* Качество по сотрудникам */}
                <div className="rounded-card bg-surface p-6 shadow-soft ring-1 ring-line">
                  <h2 className="mb-4 text-base font-semibold text-ink">Качество по сотрудникам</h2>
                  <div className="space-y-3">
                    {perEmp.map((e) => (
                      <div key={e.id} className="flex items-center gap-3">
                        <div className="w-32 shrink-0 truncate text-sm text-ink">{e.name}</div>
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-canvas">
                          <div
                            className={`h-full rounded-full ${
                              e.avg >= 80 ? "bg-emerald-500" : e.avg >= 60 ? "bg-amber-500" : "bg-red-500"
                            }`}
                            style={{ width: `${e.avg}%` }}
                          />
                        </div>
                        <Pill tone={scoreTone(e.avg)}>{e.avg}</Pill>
                        <span className="w-12 shrink-0 text-right text-xs text-faint">{formatNumber(e.n)} зв.</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Динамика качества */}
                <div className="rounded-card bg-surface p-6 shadow-soft ring-1 ring-line">
                  <h2 className="mb-4 text-base font-semibold text-ink">Динамика качества (по неделям)</h2>
                  {trend.length < 2 ? (
                    <p className="text-sm text-muted">Пока мало данных для графика — нужно несколько недель разборов.</p>
                  ) : (
                    <div className="flex h-40 items-end gap-2">
                      {trend.map((t) => (
                        <div key={t.week} className="flex flex-1 flex-col items-center gap-1">
                          <span className="text-xs font-medium text-ink">{t.avg}</span>
                          <div
                            className={`w-full rounded-t ${
                              t.avg >= 80 ? "bg-emerald-500" : t.avg >= 60 ? "bg-amber-500" : "bg-red-500"
                            }`}
                            style={{ height: `${Math.max(6, t.avg)}%` }}
                          />
                          <span className="text-[11px] text-faint">{fmtWeek(t.week)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Худшие звонки */}
              {worst.length > 0 && (
                <div className="mb-6 rounded-card border border-red-200 bg-red-50/40 p-5">
                  <h2 className="mb-3 text-base font-semibold text-ink">
                    Худшие звонки — на разбор с РОПом · {formatNumber(worst.length)}
                  </h2>
                  <div className="space-y-2">
                    {worst.slice(0, 8).map((r) => (
                      <div
                        key={r.id}
                        className="flex items-center gap-3 rounded-xl bg-surface px-3 py-2.5 ring-1 ring-line"
                      >
                        <Pill tone="danger">{Number(r.overall_score)}</Pill>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium text-ink">
                            {nameById.get(r.employee_id as string) ?? "—"}
                            <span className="ml-2 text-xs font-normal text-muted">
                              {r.role_type === "hunter" ? "хантер" : "менеджер"} · {formatDateTime(r.created_at)}
                            </span>
                          </div>
                          {r.summary && <div className="truncate text-xs text-muted">{r.summary}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Все разборы */}
              <h2 className="mb-3 text-base font-semibold text-ink">Все разборы · {formatNumber(total)}</h2>
              <div className="space-y-2.5">
                {rows.map((r) => {
                  const name = nameById.get(r.employee_id as string) ?? "—";
                  const sc = Number(r.overall_score) || 0;
                  return (
                    <details key={r.id} className="rounded-card bg-surface shadow-soft ring-1 ring-line">
                      <summary className="flex cursor-pointer list-none items-center gap-3 p-4">
                        <Pill tone={scoreTone(sc)}>{sc}/100</Pill>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold text-ink">{name}</div>
                          <div className="text-xs text-muted">
                            {r.role_type === "hunter" ? "Хантер" : "Менеджер"} · {formatDateTime(r.created_at)}
                            {r.source === "audio" ? " · аудио" : ""}
                          </div>
                        </div>
                        {r.summary ? (
                          <span className="hidden max-w-md truncate text-sm text-muted sm:block">{r.summary}</span>
                        ) : null}
                      </summary>
                      <div className="border-t border-line p-5">
                        <CallResultView result={toResult(r)} />
                      </div>
                    </details>
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
