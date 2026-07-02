import { createAdminClient } from "@/lib/supabase/admin";
import { rangeEndExclusive, type DateRange } from "@/lib/date-range";

type Admin = ReturnType<typeof createAdminClient>;

export interface FunnelStage {
  label: string;
  count: number; // сколько дошли до этого этапа
  exited: number; // сколько ушли ИМЕННО здесь (не дойдя до следующего)
}

export interface LandingFunnel {
  opened: number;
  stages: FunnelStage[]; // от «открыли» до «оставили номер», по порядку
  submitted: number;
  conversion: number; // % открывших, оставивших заявку
  worstIdx: number; // этап с наибольшим отсевом (−1, если нет)
}

/**
 * Считает воронку лендинга за диапазон дат из landing_sessions.
 * Для квиза: Открыли → каждый вопрос → Дошли до формы → Оставили номер.
 * Для простого лендинга: Открыли → Оставили номер.
 *
 * Семантика max_step в квизе: 0 — интро, 1..N — просмотр вопроса i,
 * N+1 — форма. «Просмотрел вопрос i» = max_step >= i; «дошёл до формы» = max_step >= N+1.
 */
export async function getLandingFunnel(
  admin: Admin,
  landing: { id: string; type: string; questionCount: number },
  range: DateRange,
): Promise<LandingFunnel> {
  const { data } = await admin
    .from("landing_sessions")
    .select("max_step, submitted")
    .eq("landing_id", landing.id)
    .gte("created_at", range.from)
    .lt("created_at", rangeEndExclusive(range));

  const rows = data ?? [];
  const opened = rows.length;
  const atLeast = (k: number) => rows.filter((r) => r.max_step >= k).length;
  const submitted = rows.filter((r) => r.submitted).length;

  const raw: { label: string; count: number }[] = [{ label: "Открыли", count: opened }];
  if (landing.type === "quiz" && landing.questionCount > 0) {
    for (let i = 1; i <= landing.questionCount; i++) {
      raw.push({ label: `Вопрос ${i}`, count: atLeast(i) });
    }
    raw.push({ label: "Дошли до формы", count: atLeast(landing.questionCount + 1) });
  }
  raw.push({ label: "Оставили номер", count: submitted });

  // Отсев на каждом этапе = сколько дошли сюда, но не до следующего.
  const stages: FunnelStage[] = raw.map((s, i) => ({
    label: s.label,
    count: s.count,
    exited: i < raw.length - 1 ? Math.max(0, s.count - raw[i + 1].count) : 0,
  }));

  // Этап с самым большим отсевом (в абсолюте).
  let worstIdx = -1;
  let worst = 0;
  for (let i = 0; i < stages.length - 1; i++) {
    if (stages[i].exited > worst) {
      worst = stages[i].exited;
      worstIdx = i;
    }
  }

  const conversion = opened > 0 ? (submitted / opened) * 100 : 0;
  return { opened, stages, submitted, conversion, worstIdx };
}
