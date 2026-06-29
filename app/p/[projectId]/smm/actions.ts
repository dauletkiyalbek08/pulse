"use server";

import { revalidatePath } from "next/cache";
import type { Json } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEffectiveRole } from "@/lib/queries";
import { canAccess } from "@/lib/access";
import { resolveCallAi } from "@/lib/platform-config";
import { generateIdeas, type SmmIdea } from "@/lib/smm";

async function canUse(projectId: string): Promise<boolean> {
  const role = await getEffectiveRole(projectId);
  return canAccess(role, "smm");
}

const PATH = (p: string) => `/p/${p}/smm`;

export interface IdeasResult {
  ok: boolean;
  error?: string;
  ideas?: SmmIdea[];
}

export async function generateIdeasAction(
  projectId: string,
  format: string,
  theme: string,
): Promise<IdeasResult> {
  if (!(await canUse(projectId))) return { ok: false, error: "Недостаточно прав" };

  const resolved = await resolveCallAi(projectId);
  if (!resolved.deepseekKey) {
    return { ok: false, error: "ИИ не настроен. Владелец должен добавить ключ DeepSeek в «Настройках платформы»." };
  }

  let ideas: SmmIdea[];
  try {
    ideas = await generateIdeas(resolved.deepseekKey, resolved.deepseekModel, format, theme.trim());
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Ошибка генерации" };
  }
  if (ideas.length === 0) return { ok: false, error: "Пустой ответ ИИ — попробуйте ещё раз" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const admin = createAdminClient();
  // Для счётчика «Идей сгенерировано» — храним в ai_generations.
  await admin.from("ai_generations").insert({
    project_id: projectId,
    tool: "smm_ideas",
    title: `Идеи · ${format}${theme ? ` · ${theme.trim().slice(0, 30)}` : ""}`,
    input: { format, theme } as unknown as Json,
    output: JSON.stringify(ideas),
    created_by: user?.id ?? null,
  });

  revalidatePath(PATH(projectId));
  return { ok: true, ideas };
}

export interface PostInput {
  title: string;
  format?: string;
  rubric?: string;
  goal?: string;
}

export async function addPost(projectId: string, input: PostInput): Promise<{ ok: boolean; error?: string }> {
  if (!(await canUse(projectId))) return { ok: false, error: "Недостаточно прав" };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const admin = createAdminClient();
  const { error } = await admin.from("smm_posts").insert({
    project_id: projectId,
    title: input.title.trim() || "Новый пост",
    format: input.format ?? "",
    rubric: input.rubric ?? "",
    goal: input.goal ?? "",
    status: "plan",
    created_by: user?.id ?? null,
  });
  if (error) return { ok: false, error: "Не удалось добавить пост" };
  revalidatePath(PATH(projectId));
  return { ok: true };
}

export interface PostPatch {
  title?: string;
  format?: string;
  rubric?: string;
  goal?: string;
  status?: "plan" | "scheduled" | "published";
  publish_date?: string | null;
}

export async function updatePost(projectId: string, id: string, patch: PostPatch): Promise<{ ok: boolean }> {
  if (!(await canUse(projectId))) return { ok: false };
  const admin = createAdminClient();
  await admin.from("smm_posts").update(patch).eq("project_id", projectId).eq("id", id);
  revalidatePath(PATH(projectId));
  return { ok: true };
}

export async function deletePost(projectId: string, id: string): Promise<{ ok: boolean }> {
  if (!(await canUse(projectId))) return { ok: false };
  const admin = createAdminClient();
  await admin.from("smm_posts").delete().eq("project_id", projectId).eq("id", id);
  revalidatePath(PATH(projectId));
  return { ok: true };
}
