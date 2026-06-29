/**
 * Сводка качества звонков (ИИ-оценки) за период — для дашборда и раздела «Менеджеры».
 * Читает call_analyses admin-клиентом (данные проектные, фильтр по project_id).
 * Только сервер.
 */

import { createAdminClient } from "@/lib/supabase/admin";

/** Балл ниже этого порога — звонок «на разбор с РОПом». */
export const CALL_LOW_SCORE = 60;

export interface CallQualityStats {
  count: number;
  avg: number; // 0–100
  below: number; // звонков ниже порога
  byEmployee: Map<string, { avg: number; count: number }>;
}

export async function getCallQuality(
  projectId: string,
  fromISO: string,
  toExclusiveISO: string,
): Promise<CallQualityStats> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("call_analyses")
    .select("employee_id, overall_score")
    .eq("project_id", projectId)
    .gte("created_at", fromISO)
    .lt("created_at", toExclusiveISO);

  const rows = data ?? [];
  let sum = 0;
  let below = 0;
  const acc = new Map<string, { sum: number; n: number }>();
  for (const r of rows) {
    const sc = Number(r.overall_score) || 0;
    sum += sc;
    if (sc < CALL_LOW_SCORE) below += 1;
    if (r.employee_id) {
      const a = acc.get(r.employee_id) ?? { sum: 0, n: 0 };
      a.sum += sc;
      a.n += 1;
      acc.set(r.employee_id, a);
    }
  }

  const byEmployee = new Map<string, { avg: number; count: number }>();
  for (const [id, a] of acc) byEmployee.set(id, { avg: Math.round(a.sum / a.n), count: a.n });

  return {
    count: rows.length,
    avg: rows.length ? Math.round(sum / rows.length) : 0,
    below,
    byEmployee,
  };
}
