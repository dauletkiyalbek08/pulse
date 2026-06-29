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
    .select("status, created_at")
    .eq("project_id", projectId)
    .gte("created_at", fromISO)
    .lt("created_at", toExclusiveISO);

  const cohort = leads ?? [];
  const total = cohort.length;
  const has = (...st: string[]) => cohort.filter((l) => st.includes(l.status)).length;

  if (niche === "ecommerce") {
    return [
      { label: "Лиды пришли", value: total },
      { label: "Обработано", value: has("processed", "paid") },
      { label: "Купили", value: has("paid") },
    ];
  }

  if (niche === "custom") {
    return [
      { label: "Лиды пришли", value: total },
      { label: "В работе", value: has("assigned", "paid") },
      { label: "Купили", value: has("paid") },
    ];
  }

  return [
    { label: "Лиды пришли", value: total },
    { label: "Отработано", value: has("assigned", "trial", "trial_done", "paid") },
    { label: "Записались на пробный", value: has("trial", "trial_done", "paid") },
    { label: "Урок проведён", value: has("trial_done", "paid") },
    { label: "Купили курс", value: has("paid") },
  ];
}
