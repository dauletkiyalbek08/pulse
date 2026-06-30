import { createClient } from "@/lib/supabase/server";
import { localDay } from "@/lib/attendance";

type Client = Awaited<ReturnType<typeof createClient>>;

/**
 * Равная раздача лидов между хантерами: лид идёт тому, у кого СЕГОДНЯ назначено
 * меньше всего лидов (20 на 2 → 10/10; на 3 → 7/7/6).
 *
 * Сначала раздаём хантерам НА СМЕНЕ. Если на смене никого нет:
 *  - opts.fallbackToAll = true → раздаём любому активному хантеру (новый лид не
 *    должен висеть «свободным»; так каждый входящий лид сразу за кем-то закреплён);
 *  - иначе → null (например, при передаче лида — передаём только тем, кто на смене).
 */
export async function pickNextHunter(
  supabase: Client,
  projectId: string,
  excludeUserId?: string,
  opts: { fallbackToAll?: boolean } = {},
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
  const onShift = [...new Set((openShifts ?? []).map((s) => s.user_id))].filter(
    (id) => hunterIds.has(id) && id !== excludeUserId,
  );

  // Кому раздаём: приоритет — на смене; запасной вариант — все активные хантеры.
  let pool = onShift;
  if (pool.length === 0 && opts.fallbackToAll) {
    pool = [...hunterIds].filter((id) => id !== excludeUserId);
  }

  if (pool.length === 0) return null;
  if (pool.length === 1) return pool[0];

  // Детерминированный порядок для разрыва ничьих (чёткое чередование)
  pool.sort();

  // Сколько лидов СЕГОДНЯ уже назначено каждому хантеру из пула
  const sinceISO = `${localDay()}T00:00:00+05:00`; // начало суток (Алматы, UTC+5)
  const { data: todays } = await supabase
    .from("leads")
    .select("assigned_to")
    .eq("project_id", projectId)
    .in("assigned_to", pool)
    .gte("created_at", sinceISO);

  const count = new Map(pool.map((id) => [id, 0]));
  for (const l of todays ?? []) {
    if (l.assigned_to && count.has(l.assigned_to)) {
      count.set(l.assigned_to, (count.get(l.assigned_to) ?? 0) + 1);
    }
  }

  // Хантер с минимальным числом лидов сегодня (ничья — по порядку пула)
  let best = pool[0];
  for (const id of pool) {
    if ((count.get(id) ?? 0) < (count.get(best) ?? 0)) best = id;
  }
  return best;
}
