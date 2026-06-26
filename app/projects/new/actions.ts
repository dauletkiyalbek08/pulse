"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isNiche, NICHES } from "@/lib/niches";

export interface NewProjectState {
  error: string | null;
}

export async function createProject(
  _prev: NewProjectState,
  formData: FormData,
): Promise<NewProjectState> {
  const name = String(formData.get("name") ?? "").trim();
  const niche = String(formData.get("niche") ?? "");
  const director = String(formData.get("director_name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();

  if (!name) return { error: "Введите название проекта" };
  if (!isNiche(niche)) return { error: "Выберите нишу проекта" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const template = NICHES[niche];
  const { data: project, error } = await supabase
    .from("projects")
    .insert({
      owner_id: user.id,
      name,
      niche,
      director_name: director || null,
      description: description || null,
      icon: template.icon,
      accent_color: template.accent,
    })
    .select("id")
    .single();

  if (error || !project) {
    return { error: "Не удалось создать проект. Попробуйте ещё раз." };
  }

  // Журнал действий (ТЗ, раздел 3.4)
  await supabase.from("activity_log").insert({
    project_id: project.id,
    actor_id: user.id,
    action: "project.created",
    details: { name, niche },
  });

  redirect("/");
}
