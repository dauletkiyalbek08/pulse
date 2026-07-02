import { createAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createAdminClient>;

export interface FunnelStage {
  label: string;
  count: number;
}

export interface LandingFunnel {
  opened: number;
  stages: FunnelStage[]; // от «открыли» до «оставили номер», по порядку
  submitted: number;
  conversion: number; // % открывших, оставивших заявку
}

/**
 * Считает воронку лендинга за период (по умолчанию 30 дней) из landing_sessions.
 * Для квиза: Открыли → каждый вопрос → Дошли до формы → Оставили номер.
 * Для простого лендинга: Открыли → Оставили номер.
 *
 * Семантика max_step в квизе: 0 — интро, 1..N — просмотр вопроса i,
 * N+1 — форма. «Просмотрел вопрос i» = max_step >= i; «дошёл до формы» = max_step >= N+1.
 */
export async function getLandingFunnel(
  admin: Admin,
  landing: { id: string; type: string; questionCount: number },
  days = 30,
): Promise<LandingFunnel> {
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const { data } = await admin
    .from("landing_sessions")
    .select("max_step, submitted")
    .eq("landing_id", landing.id)
    .gte("created_at", since);

  const rows = data ?? [];
  const opened = rows.length;
  const atLeast = (k: number) => rows.filter((r) => r.max_step >= k).length;
  const submitted = rows.filter((r) => r.submitted).length;

  const stages: FunnelStage[] = [{ label: "Открыли", count: opened }];

  if (landing.type === "quiz" && landing.questionCount > 0) {
    for (let i = 1; i <= landing.questionCount; i++) {
      stages.push({ label: `Вопрос ${i}`, count: atLeast(i) });
    }
    stages.push({ label: "Дошли до формы", count: atLeast(landing.questionCount + 1) });
  }

  stages.push({ label: "Оставили номер", count: submitted });

  const conversion = opened > 0 ? (submitted / opened) * 100 : 0;
  return { opened, stages, submitted, conversion };
}
