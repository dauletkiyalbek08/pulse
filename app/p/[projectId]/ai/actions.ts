"use server";

import { revalidatePath } from "next/cache";
import type { Json } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEffectiveRole } from "@/lib/queries";
import { canAccess } from "@/lib/access";
import { resolveCallAi } from "@/lib/platform-config";
import { toolByKey, generateText } from "@/lib/ai-studio";

async function canUse(projectId: string): Promise<boolean> {
  const role = await getEffectiveRole(projectId);
  return canAccess(role, "ai");
}

export interface GenerateResult {
  ok: boolean;
  error?: string;
  id?: string;
  output?: string;
}

export async function generate(
  projectId: string,
  toolKey: string,
  values: Record<string, string>,
): Promise<GenerateResult> {
  if (!(await canUse(projectId))) return { ok: false, error: "Недостаточно прав" };

  const tool = toolByKey(toolKey);
  if (!tool) return { ok: false, error: "Неизвестный инструмент" };

  const resolved = await resolveCallAi(projectId);
  if (!resolved.deepseekKey) {
    return {
      ok: false,
      error: "ИИ не настроен. Владелец платформы должен добавить ключ DeepSeek в «Настройках платформы».",
    };
  }

  let output: string;
  try {
    output = await generateText(resolved.deepseekKey, resolved.deepseekModel, tool.prompt(values), tool.temperature);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Ошибка генерации" };
  }
  if (!output) return { ok: false, error: "Пустой ответ ИИ — попробуйте ещё раз" };

  const firstVal = tool.fields.map((f) => (values[f.name] ?? "").trim()).find(Boolean) ?? "";
  const title = firstVal ? `${tool.title} · ${firstVal.slice(0, 40)}` : tool.title;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const admin = createAdminClient();
  const { data } = await admin
    .from("ai_generations")
    .insert({
      project_id: projectId,
      tool: toolKey,
      title,
      input: values as unknown as Json,
      output,
      created_by: user?.id ?? null,
    })
    .select("id")
    .maybeSingle();

  revalidatePath(`/p/${projectId}/ai`);
  return { ok: true, id: data?.id, output };
}

export async function deleteGeneration(projectId: string, id: string): Promise<{ ok: boolean }> {
  if (!(await canUse(projectId))) return { ok: false };
  const admin = createAdminClient();
  await admin.from("ai_generations").delete().eq("project_id", projectId).eq("id", id);
  revalidatePath(`/p/${projectId}/ai`);
  return { ok: true };
}
