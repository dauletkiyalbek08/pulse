import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { canAccess } from "@/lib/access";
import { isModuleEnabled } from "@/lib/menu";

/**
 * Проект, закэшированный на время одного запроса (React cache).
 * Layout и страница вызывают getProject(projectId) — поход в БД будет один.
 */
export const getProject = cache(async (projectId: string) => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("projects")
    .select(
      "id, name, niche, icon, accent_color, owner_id, modules, office_lat, office_lng, office_radius_m, office_address",
    )
    .eq("id", projectId)
    .maybeSingle();
  return data;
});

/**
 * Эффективная роль текущего пользователя В ЭТОМ проекте (кэш на запрос):
 * - 'owner'    — владелец платформы (видит всё);
 * - 'director' — владелец проекта;
 * - роль из project_members (active) — для остальных;
 * - null       — не участник проекта.
 */
export const getEffectiveRole = cache(
  async (projectId: string): Promise<string | null> => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const [{ data: profile }, project] = await Promise.all([
      supabase.from("profiles").select("global_role").eq("id", user.id).maybeSingle(),
      getProject(projectId),
    ]);

    if (profile?.global_role === "owner") return "owner";
    if (project?.owner_id === user.id) return "director";

    const { data: member } = await supabase
      .from("project_members")
      .select("role")
      .eq("project_id", projectId)
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle();
    return member?.role ?? null;
  },
);

/**
 * Серверная защита маршрута: вызывать в начале страницы.
 * Не участник проекта — на портал; нет доступа к разделу — на дашборд проекта.
 */
export async function requireAccess(projectId: string, segment: string) {
  const role = await getEffectiveRole(projectId);
  if (!role) redirect("/");
  if (!canAccess(role, segment)) redirect(`/p/${projectId}`);
  // Раздел выключен для этого проекта владельцем/директором — закрываем по URL тоже.
  const project = await getProject(projectId);
  if (!isModuleEnabled(project?.modules, segment)) redirect(`/p/${projectId}`);
}
