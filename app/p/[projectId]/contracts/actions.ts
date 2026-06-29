"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEffectiveRole } from "@/lib/queries";
import { canAccess } from "@/lib/access";
import { SAMPLE_TEMPLATES } from "@/lib/document-samples";

async function canManage(projectId: string): Promise<boolean> {
  const role = await getEffectiveRole(projectId);
  return canAccess(role, "contracts");
}

async function userId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

const PATH = (p: string) => `/p/${p}/contracts`;

/** Добавить набор шаблонов-примеров (один раз — если шаблонов ещё нет). */
export async function seedSampleTemplates(projectId: string): Promise<{ ok: boolean; error?: string }> {
  if (!(await canManage(projectId))) return { ok: false, error: "Недостаточно прав" };
  const admin = createAdminClient();
  const { count } = await admin
    .from("document_templates")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId);
  if ((count ?? 0) > 0) return { ok: false, error: "Шаблоны уже есть" };

  const rows = SAMPLE_TEMPLATES.map((t) => ({
    project_id: projectId,
    name: t.name,
    category: t.category,
    body: t.body,
    is_sample: true,
  }));
  const { error } = await admin.from("document_templates").insert(rows);
  if (error) return { ok: false, error: "Не удалось добавить примеры" };
  revalidatePath(PATH(projectId));
  return { ok: true };
}

export interface TemplateInput {
  name: string;
  category: string;
  body: string;
}

export async function createTemplate(
  projectId: string,
  input: TemplateInput,
): Promise<{ ok: boolean; error?: string; id?: string }> {
  if (!(await canManage(projectId))) return { ok: false, error: "Недостаточно прав" };
  if (!input.name.trim()) return { ok: false, error: "Укажите название шаблона" };
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("document_templates")
    .insert({
      project_id: projectId,
      name: input.name.trim(),
      category: input.category || "hr",
      body: input.body,
    })
    .select("id")
    .maybeSingle();
  if (error || !data) return { ok: false, error: "Не удалось создать шаблон" };
  revalidatePath(PATH(projectId));
  return { ok: true, id: data.id };
}

export async function updateTemplate(
  projectId: string,
  id: string,
  input: TemplateInput,
): Promise<{ ok: boolean; error?: string }> {
  if (!(await canManage(projectId))) return { ok: false, error: "Недостаточно прав" };
  if (!input.name.trim()) return { ok: false, error: "Укажите название шаблона" };
  const admin = createAdminClient();
  const { error } = await admin
    .from("document_templates")
    .update({ name: input.name.trim(), category: input.category || "hr", body: input.body, is_sample: false })
    .eq("project_id", projectId)
    .eq("id", id);
  if (error) return { ok: false, error: "Не удалось сохранить шаблон" };
  revalidatePath(PATH(projectId));
  return { ok: true };
}

export async function deleteTemplate(projectId: string, id: string): Promise<{ ok: boolean }> {
  if (!(await canManage(projectId))) return { ok: false };
  const admin = createAdminClient();
  await admin.from("document_templates").delete().eq("project_id", projectId).eq("id", id);
  revalidatePath(PATH(projectId));
  return { ok: true };
}

export interface DocumentInput {
  templateId?: string | null;
  title: string;
  category: string;
  body: string;
  employeeId?: string | null;
}

export async function createDocument(
  projectId: string,
  input: DocumentInput,
): Promise<{ ok: boolean; error?: string; id?: string }> {
  if (!(await canManage(projectId))) return { ok: false, error: "Недостаточно прав" };
  if (!input.title.trim()) return { ok: false, error: "Укажите название документа" };
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("documents")
    .insert({
      project_id: projectId,
      template_id: input.templateId ?? null,
      title: input.title.trim(),
      category: input.category || "hr",
      body: input.body,
      employee_id: input.employeeId ?? null,
      status: "draft",
      created_by: await userId(),
    })
    .select("id")
    .maybeSingle();
  if (error || !data) return { ok: false, error: "Не удалось создать документ" };
  revalidatePath(PATH(projectId));
  return { ok: true, id: data.id };
}

export async function updateDocumentStatus(
  projectId: string,
  id: string,
  status: "draft" | "signed" | "archived",
): Promise<{ ok: boolean }> {
  if (!(await canManage(projectId))) return { ok: false };
  const admin = createAdminClient();
  await admin.from("documents").update({ status }).eq("project_id", projectId).eq("id", id);
  revalidatePath(PATH(projectId));
  return { ok: true };
}

export async function deleteDocument(projectId: string, id: string): Promise<{ ok: boolean }> {
  if (!(await canManage(projectId))) return { ok: false };
  const admin = createAdminClient();
  await admin.from("documents").delete().eq("project_id", projectId).eq("id", id);
  revalidatePath(PATH(projectId));
  return { ok: true };
}
