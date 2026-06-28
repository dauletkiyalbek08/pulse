import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAccess, getEffectiveRole } from "@/lib/queries";
import { formatDateTime, formatNumber } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { Pill } from "@/components/pill";
import type { PillTone } from "@/lib/leads";
import { CallAiSettings } from "@/components/call-ai-settings";
import { CallAnalyzeForm, type Employee } from "@/components/call-analyze-form";
import { CallResultView } from "@/components/call-result-view";
import { getCallAiStatus } from "@/app/p/[projectId]/calls/actions";
import type { CallResult, CriterionScore } from "@/lib/call-analysis";

const MANAGE_ROLES = ["owner", "director", "head_sales"];

function scoreTone(s: number): PillTone {
  if (s >= 80) return "success";
  if (s >= 60) return "warning";
  return "danger";
}

export default async function CallsPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  await requireAccess(projectId, "calls");

  const supabase = await createClient();
  const admin = createAdminClient();
  const role = await getEffectiveRole(projectId);
  const canManage = MANAGE_ROLES.includes(role ?? "");
  const isOwner = role === "owner";

  const status = await getCallAiStatus(projectId);

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

  // Разборы + средние по сотрудникам (только если подключено)
  let recent: Record<string, unknown>[] = [];
  const avgByEmp = new Map<string, { sum: number; n: number }>();
  if (status?.connected) {
    const [{ data: rows }, { data: allScores }] = await Promise.all([
      admin
        .from("call_analyses")
        .select("id, employee_id, role_type, overall_score, summary, criteria, strengths, issues, recommendations, created_at")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(20),
      admin.from("call_analyses").select("employee_id, overall_score").eq("project_id", projectId),
    ]);
    recent = (rows ?? []) as Record<string, unknown>[];
    for (const r of allScores ?? []) {
      if (!r.employee_id) continue;
      const a = avgByEmp.get(r.employee_id) ?? { sum: 0, n: 0 };
      a.sum += Number(r.overall_score);
      a.n += 1;
      avgByEmp.set(r.employee_id, a);
    }
  }

  const toResult = (r: Record<string, unknown>): CallResult => ({
    overall: Number(r.overall_score) || 0,
    criteria: Array.isArray(r.criteria) ? (r.criteria as CriterionScore[]) : [],
    strengths: Array.isArray(r.strengths) ? (r.strengths as string[]) : [],
    issues: Array.isArray(r.issues) ? (r.issues as string[]) : [],
    recommendations: Array.isArray(r.recommendations) ? (r.recommendations as string[]) : [],
    summary: (r.summary as string) ?? "",
  });

  const averages = [...avgByEmp.entries()]
    .map(([id, a]) => ({ name: nameById.get(id) ?? "—", avg: Math.round(a.sum / a.n), n: a.n }))
    .sort((a, b) => b.avg - a.avg);

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <PageHeader title="Анализ звонков" subtitle="ИИ-оценка разговоров по правилам отдела (DeepSeek)" />

      <div className="mb-6">
        <CallAiSettings projectId={projectId} status={status} canManage={canManage} isOwner={isOwner} />
      </div>

      {status?.connected && (
        <>
          <div className="mb-6">
            <CallAnalyzeForm projectId={projectId} employees={employees} asrConnected={status.asrConnected} />
          </div>

          {averages.length > 0 && (
            <div className="mb-6 rounded-card bg-surface p-6 shadow-soft ring-1 ring-line">
              <h2 className="mb-4 text-base font-semibold text-ink">Качество по сотрудникам</h2>
              <div className="flex flex-wrap gap-2.5">
                {averages.map((a) => (
                  <div
                    key={a.name}
                    className="inline-flex items-center gap-2 rounded-xl bg-canvas px-3.5 py-2 ring-1 ring-line"
                  >
                    <span className="text-sm font-medium text-ink">{a.name}</span>
                    <Pill tone={scoreTone(a.avg)}>{a.avg}/100</Pill>
                    <span className="text-xs text-faint">{formatNumber(a.n)} зв.</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <h2 className="mb-3 text-base font-semibold text-ink">
            Последние разборы{recent.length > 0 ? ` · ${formatNumber(recent.length)}` : ""}
          </h2>
          {recent.length === 0 ? (
            <div className="rounded-card border border-dashed border-line bg-surface px-6 py-12 text-center text-sm text-muted">
              Разборов пока нет. Вставьте текст разговора выше и нажмите «Анализировать».
            </div>
          ) : (
            <div className="space-y-2.5">
              {recent.map((r) => {
                const name = nameById.get(r.employee_id as string) ?? "—";
                const score = Number(r.overall_score) || 0;
                return (
                  <details key={r.id as string} className="rounded-card bg-surface shadow-soft ring-1 ring-line">
                    <summary className="flex cursor-pointer list-none items-center gap-3 p-4">
                      <Pill tone={scoreTone(score)}>{score}/100</Pill>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-ink">{name}</div>
                        <div className="text-xs text-muted">
                          {r.role_type === "hunter" ? "Хантер" : "Менеджер"} · {formatDateTime(r.created_at as string)}
                        </div>
                      </div>
                      {r.summary ? <span className="hidden max-w-md truncate text-sm text-muted sm:block">{r.summary as string}</span> : null}
                    </summary>
                    <div className="border-t border-line p-5">
                      <CallResultView result={toResult(r)} />
                    </div>
                  </details>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
