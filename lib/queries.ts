import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

/**
 * Проект, закэшированный на время одного запроса (React cache).
 * Layout и страница вызывают getProject(projectId) — поход в БД будет один.
 */
export const getProject = cache(async (projectId: string) => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("projects")
    .select("id, name, niche, icon, accent_color")
    .eq("id", projectId)
    .maybeSingle();
  return data;
});
