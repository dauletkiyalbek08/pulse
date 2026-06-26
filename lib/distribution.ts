import { createClient } from "@/lib/supabase/server";

type Client = Awaited<ReturnType<typeof createClient>>;

/**
 * Round-robin раздача лидов: возвращает user_id следующего хантера,
 * который СЕЙЧАС НА СМЕНЕ (открытая смена) и которому дольше всех не назначали лид.
 * Если на смене нет ни одного хантера — возвращает null (лид остаётся свободным).
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

  // Время последнего назначенного лида у каждого хантера на смене (null = никогда)
  const { data: recent } = await supabase
    .from("leads")
    .select("assigned_to, created_at")
    .eq("project_id", projectId)
    .in("assigned_to", onShift)
    .order("created_at", { ascending: false });

  const lastAt = new Map<string, string>();
  for (const r of recent ?? []) {
    if (r.assigned_to && !lastAt.has(r.assigned_to)) lastAt.set(r.assigned_to, r.created_at);
  }

  // Никогда не получавшие — в начало очереди; затем по самой старой дате назначения
  onShift.sort((a, b) => {
    const ta = lastAt.get(a);
    const tb = lastAt.get(b);
    if (!ta && !tb) return 0;
    if (!ta) return -1;
    if (!tb) return 1;
    return ta.localeCompare(tb);
  });

  return onShift[0];
}
