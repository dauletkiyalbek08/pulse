"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEffectiveRole } from "@/lib/queries";
import { decryptSecret } from "@/lib/crypto";
import { uploadAdVideo, generateAdCopy, launchFromDraft } from "@/lib/meta-launch";

const MANAGE_ROLES = ["owner", "director", "marketer", "targetologist"];
const BUCKET = "ad-videos";

async function canManage(projectId: string): Promise<boolean> {
  const role = await getEffectiveRole(projectId);
  return !!role && MANAGE_ROLES.includes(role);
}

export interface UploadTicket {
  ok: boolean;
  error?: string;
  path?: string;
  token?: string;
}

/** Подписанный URL для прямой загрузки видео из браузера в хранилище. */
export async function createAdVideoUploadUrl(
  projectId: string,
  filename: string,
): Promise<UploadTicket> {
  if (!(await canManage(projectId))) return { ok: false, error: "Недостаточно прав" };

  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-60) || "video.mp4";
  const path = `${projectId}/${Date.now()}-${safe}`;

  const admin = createAdminClient();
  const { data, error } = await admin.storage.from(BUCKET).createSignedUploadUrl(path);
  if (error || !data) return { ok: false, error: "Не удалось подготовить загрузку" };
  return { ok: true, path: data.path, token: data.token };
}

export interface WebDraftResult {
  ok: boolean;
  error?: string;
  draftId?: string;
  headline?: string;
  primaryText?: string;
}

/**
 * Черновик из загруженного видео: Meta забирает файл по публичному URL хранилища,
 * DeepSeek пишет текст, создаётся ad_launches (без Telegram-чата).
 */
export async function createWebDraft(
  projectId: string,
  storagePath: string,
  offer: string,
): Promise<WebDraftResult> {
  if (!(await canManage(projectId))) return { ok: false, error: "Недостаточно прав" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Нет авторизации" };

  const admin = createAdminClient();
  const { data: integ } = await admin
    .from("meta_integration")
    .select("ad_account_id, token_enc")
    .eq("project_id", projectId)
    .eq("purpose", "course")
    .maybeSingle();
  if (!integ) return { ok: false, error: "Сначала подключите кабинет Meta" };

  const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(storagePath);
  const publicUrl = pub?.publicUrl;
  if (!publicUrl) return { ok: false, error: "Видео не найдено в хранилище" };

  let metaVideoId: string;
  try {
    const token = decryptSecret(integ.token_enc);
    metaVideoId = await uploadAdVideo(integ.ad_account_id, token, publicUrl, "Pulse авто (сайт)");
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Meta не приняла видео" };
  }

  const [copy, cfgRes] = await Promise.all([
    generateAdCopy(projectId, offer),
    admin.from("ad_launch_config").select("daily_budget_usd").eq("project_id", projectId).maybeSingle(),
  ]);
  const budget = Number(cfgRes.data?.daily_budget_usd ?? 5);

  const { data: draft, error } = await admin
    .from("ad_launches")
    .insert({
      project_id: projectId,
      created_by: user.id,
      chat_id: null,
      purpose: "course",
      meta_video_id: metaVideoId,
      offer: offer || null,
      primary_text: copy.primaryText,
      headline: copy.headline,
      budget_usd: budget,
      status: "draft",
    })
    .select("id")
    .maybeSingle();
  if (error || !draft) return { ok: false, error: "Не удалось сохранить черновик" };

  return { ok: true, draftId: draft.id, headline: copy.headline, primaryText: copy.primaryText };
}

/** Правка черновика: текст, гео (город/вся страна), Advantage. */
export async function updateWebDraft(
  projectId: string,
  draftId: string,
  patch: { headline?: string; primaryText?: string; geoCity?: string | null; advantage?: boolean },
): Promise<{ ok: boolean; error?: string }> {
  if (!(await canManage(projectId))) return { ok: false, error: "Недостаточно прав" };
  const admin = createAdminClient();
  const upd: {
    updated_at: string;
    headline?: string;
    primary_text?: string;
    geo_city?: string | null;
    advantage?: boolean;
  } = { updated_at: new Date().toISOString() };
  if (patch.headline !== undefined) upd.headline = patch.headline;
  if (patch.primaryText !== undefined) upd.primary_text = patch.primaryText;
  if (patch.geoCity !== undefined) upd.geo_city = patch.geoCity;
  if (patch.advantage !== undefined) upd.advantage = patch.advantage;
  const { error } = await admin.from("ad_launches").update(upd).eq("id", draftId).eq("project_id", projectId);
  if (error) return { ok: false, error: "Не удалось сохранить" };
  return { ok: true };
}

export async function regenerateWebText(
  projectId: string,
  draftId: string,
): Promise<{ ok: boolean; headline?: string; primaryText?: string; error?: string }> {
  if (!(await canManage(projectId))) return { ok: false, error: "Недостаточно прав" };
  const admin = createAdminClient();
  const { data: draft } = await admin
    .from("ad_launches")
    .select("offer")
    .eq("id", draftId)
    .eq("project_id", projectId)
    .maybeSingle();
  const copy = await generateAdCopy(projectId, draft?.offer ?? "");
  await admin
    .from("ad_launches")
    .update({ headline: copy.headline, primary_text: copy.primaryText, updated_at: new Date().toISOString() })
    .eq("id", draftId);
  return { ok: true, headline: copy.headline, primaryText: copy.primaryText };
}

export interface WebLaunchOutcome {
  ok: boolean;
  error?: string;
  notReady?: boolean;
}

export async function launchWebDraft(
  projectId: string,
  draftId: string,
): Promise<WebLaunchOutcome> {
  if (!(await canManage(projectId))) return { ok: false, error: "Недостаточно прав" };
  const admin = createAdminClient();
  await admin.from("ad_launches").update({ status: "launching" }).eq("id", draftId).eq("status", "draft");
  const res = await launchFromDraft(admin, draftId);
  if (res.notReady) {
    await admin.from("ad_launches").update({ status: "draft" }).eq("id", draftId);
    return { ok: false, notReady: true, error: "Видео ещё обрабатывается Meta — подождите минуту." };
  }
  revalidatePath(`/p/${projectId}/ads`);
  return { ok: res.ok, error: res.error };
}
