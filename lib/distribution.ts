import { createClient } from "@/lib/supabase/server";
import { localDay } from "@/lib/attendance";

type Client = Awaited<ReturnType<typeof createClient>>;

/**
 * Равная раздача лидов между хантерами НА СМЕНЕ: лид идёт тому, у кого СЕГОДНЯ
 * назначено меньше всего лидов. Так нагрузка делится поровну (20 на 2 → 10/10;
 * на 3 → 7/7/6). Если на смене нет хантеров — null (лид остаётся свободным).
 */
export async function pickNextHunter(
  supabase: Client,
  projectId: string,
): Promise<string | null> {
  const [{ data: hunters }, { data: openShifts }] = await Promise.all([
    supabase
      .from("project_members")
      .select("user_id")
      .eq("project_id", projectId)
      .eq("role", "hunter")
      .eq("status", "active"),
    supabase
      .from("shifts")
      .select("user_id")
      .eq("project_id", projectId)
      .eq("status", "open"),
  ]);

  const hunterIds = new Set((hunters ?? []).map((h) => h.user_id));
  const onShift = [...new Set((openShifts ?? []).map((s) => s.user_id))].filter((id) =>
    hunterIds.has(id),
  );

  if (onShift.length === 0) return null;
  if (onShift.length === 1) return onShift[0];

  // Детерминированный порядок для разрыва ничьих (чёткое чередование)
  onShift.sort();

  // Сколько лидов СЕГОДНЯ уже назначено каждому хантеру на смене
  const sinceISO = `${localDay()}T00:00:00+05:00`; // начало суток (Алматы, UTC+5)
  const { data: todays } = await supabase
    .from("leads")
    .select("assigned_to")
    .eq("project_id", projectId)
    .in("assigned_to", onShift)
    .gte("created_at", sinceISO);

  const count = new Map(onShift.map((id) => [id, 0]));
  for (const l of todays ?? []) {
    if (l.assigned_to && count.has(l.assigned_to)) {
      count.set(l.assigned_to, (count.get(l.assigned_to) ?? 0) + 1);
    }
  }

  // Хантер с минимальным числом лидов сегодня (ничья — по порядку onShift)
  let best = onShift[0];
  for (const id of onShift) {
    if ((count.get(id) ?? 0) < (count.get(best) ?? 0)) best = id;
  }
  return best;
}
