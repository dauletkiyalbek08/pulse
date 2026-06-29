"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import type { Json } from "@/lib/database.types";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEffectiveRole } from "@/lib/queries";
import { canAccess } from "@/lib/access";

async function canManage(projectId: string): Promise<boolean> {
  const role = await getEffectiveRole(projectId);
  return canAccess(role, "resources");
}

function randomSlug(): string {
  return Math.random().toString(36).slice(2, 8);
}

/** Гарантируем у проекта site_token — он нужен форме лендинга для приёма заявок. */
async function ensureSiteToken(projectId: string): Promise<void> {
  const admin = createAdminClient();
  const { data } = await admin.from("projects").select("site_token").eq("id", projectId).maybeSingle();
  if (!data?.site_token) {
    await admin
      .from("projects")
      .update({ site_token: randomUUID().replace(/-/g, "") })
      .eq("id", projectId);
  }
}

export interface CreateLandingResult {
  ok: boolean;
  error?: string;
  id?: string;
}

export async function createLanding(projectId: string): Promise<CreateLandingResult> {
  if (!(await canManage(projectId))) return { ok: false, error: "Недостаточно прав" };
  await ensureSiteToken(projectId);

  const admin = createAdminClient();
  let slug = randomSlug();
  for (let i = 0; i < 5; i++) {
    const { data: ex } = await admin.from("landings").select("id").eq("slug", slug).maybeSingle();
    if (!ex) break;
    slug = randomSlug();
  }

  const { data, error } = await admin
    .from("landings")
    .insert({ project_id: projectId, slug })
    .select("id")
    .maybeSingle();
  if (error || !data) return { ok: false, error: "Не удалось создать лендинг" };

  revalidatePath(`/p/${projectId}/resources`);
  return { ok: true, id: data.id };
}

export interface LandingPatch {
  title: string;
  subtitle: string;
  bullets: string[];
  button_text: string;
  thanks_text: string;
  accent: string;
  pixel_id: string;
  slug: string;
  status: "active" | "draft";
}

export async function updateLanding(
  projectId: string,
  id: string,
  patch: LandingPatch,
): Promise<{ ok: boolean; error?: string }> {
  if (!(await canManage(projectId))) return { ok: false, error: "Недостаточно прав" };

  const slug = patch.slug.trim().toLowerCase();
  if (!/^[a-z0-9-]{3,40}$/.test(slug)) {
    return { ok: false, error: "Ссылка: 3–40 символов, латиница, цифры и дефис" };
  }

  const admin = createAdminClient();
  const { data: ex } = await admin.from("landings").select("id").eq("slug", slug).maybeSingle();
  if (ex && ex.id !== id) return { ok: false, error: "Такая ссылка уже занята — выберите другую" };

  const { error } = await admin
    .from("landings")
    .update({
      title: patch.title.trim() || "Бесплатный пробный урок",
      subtitle: patch.subtitle.trim(),
      bullets: patch.bullets.map((b) => b.trim()).filter(Boolean) as unknown as Json,
      button_text: patch.button_text.trim() || "Оставить заявку",
      thanks_text: patch.thanks_text.trim() || "Спасибо! Мы свяжемся с вами в ближайшее время.",
      accent: patch.accent.trim() || "#16a34a",
      pixel_id: patch.pixel_id.trim() || null,
      slug,
      status: patch.status === "draft" ? "draft" : "active",
    })
    .eq("project_id", projectId)
    .eq("id", id);
  if (error) return { ok: false, error: "Не удалось сохранить изменения" };

  revalidatePath(`/p/${projectId}/resources`);
  return { ok: true };
}

export async function deleteLanding(projectId: string, id: string): Promise<{ ok: boolean }> {
  if (!(await canManage(projectId))) return { ok: false };
  const admin = createAdminClient();
  await admin.from("landings").delete().eq("project_id", projectId).eq("id", id);
  revalidatePath(`/p/${projectId}/resources`);
  return { ok: true };
}
