/**
 * Когортная воронка по периоду.
 *
 * Берём лиды, СОЗДАННЫЕ в выбранном диапазоне дат (по времени прихода заявки),
 * и считаем, до какого этапа дошёл каждый из них — «сколько из них». Период
 * задаётся глобальным пикером (Сегодня / Вчера / 7 / 30 дней / произвольный).
 *
 * education: Лиды → Отработано → Записались на пробный → Урок проведён → Купили курс
 * ecommerce: Лиды → Обработано → Купили
 */
import { createClient } from "@/lib/supabase/server";
import type { DateRange } from "@/lib/date-range";
import type { Niche } from "@/lib/niches";

export interface FunnelStep {
  label: string;
  value: number;
}

/** Границы диапазона как UTC-таймстемпы (to — включительно, поэтому +1 день и `<`). */
function rangeBounds(range: DateRange): { fromISO: string; toExclusiveISO: string } {
  const to = new Date(`${range.to}T00:00:00Z`);
  to.setUTCDate(to.getUTCDate() + 1);
  return {
    fromISO: `${range.from}T00:00:00Z`,
    toExclusiveISO: to.toISOString(),
  };
}

export async function getCohortFunnel(
  projectId: string,
  niche: Niche,
  range: DateRange,
): Promise<FunnelStep[]> {
  const supabase = await createClient();
  const { fromISO, toExclusiveISO } = rangeBounds(range);

  const { data: leads } = await supabase
    .from("leads")
    .select("id, status, created_at")
    .eq("project_id", projectId)
    .gte("created_at", fromISO)
    .lt("created_at", toExclusiveISO);

  const cohort = leads ?? [];
  const total = cohort.length;

  if (niche === "ecommerce") {
    const processed = cohort.filter((l) => ["processed", "sale"].includes(l.status)).length;
    const sold = cohort.filter((l) => l.status === "sale").length;
    return [
      { label: "Лиды пришли", value: total },
      { label: "Обработано", value: processed },
      { label: "Купили", value: sold },
    ];
  }

  // education: «урок проведён» определяется по пробным со статусом attended/purchased
  const leadIds = cohort.map((l) => l.id);
  let conducted = new Set<string>();
  if (leadIds.length) {
    const { data: trials } = await supabase
      .from("trials")
      .select("lead_id, status")
      .eq("project_id", projectId)
      .in("lead_id", leadIds)
      .in("status", ["attended", "purchased"]);
    conducted = new Set(
      (trials ?? []).map((t) => t.lead_id).filter(Boolean) as string[],
    );
  }

  const worked = cohort.filter((l) =>
    ["qualified", "trial", "sale"].includes(l.status),
  ).length;
  const toTrial = cohort.filter((l) => ["trial", "sale"].includes(l.status)).length;
  const conductedCount = cohort.filter((l) => conducted.has(l.id)).length;
  const sold = cohort.filter((l) => l.status === "sale").length;

  return [
    { label: "Лиды пришли", value: total },
    { label: "Отработано", value: worked },
    { label: "Записались на пробный", value: toTrial },
    { label: "Урок проведён", value: conductedCount },
    { label: "Купили курс", value: sold },
  ];
}
