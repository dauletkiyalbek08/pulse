"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEffectiveRole } from "@/lib/queries";
import { decryptSecret } from "@/lib/crypto";
import {
  uploadAdVideo,
  generateAdCopy,
  launchFromDraft,
  updateAdSetBudget,
  pauseCampaign,
} from "@/lib/meta-launch";
import { fetchCampaignInsights, fetchCampaignSyncStatus } from "@/lib/meta";
import { getRevenueByCampaign } from "@/lib/ad-revenue";
import { almatyYmd } from "@/lib/reports-tg";

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
  const path = `${projectId}/${randomUUID()}-${safe}`;

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

export interface MediaItemInput {
  path: string;
  kind: "video" | "image";
}

/**
 * Черновик из загруженных файлов (несколько видео и/или картинок): Meta забирает
 * каждый по публичному URL, DeepSeek пишет текст. Все креативы — в одном запуске
 * (одна кампания → одна группа → N объявлений). ad_launches без Telegram-чата.
 */
export async function createWebDraft(
  projectId: string,
  items: MediaItemInput[],
  offer: string,
): Promise<WebDraftResult> {
  if (!(await canManage(projectId))) return { ok: false, error: "Недостаточно прав" };
  if (!items || items.length === 0) return { ok: false, error: "Не выбрано ни одного файла" };

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

  const token = decryptSecret(integ.token_enc);

  // Загрузка каждого медиа: видео → в Meta (video_id); картинка → публичный URL
  const mediaToInsert: {
    kind: "video" | "image";
    meta_video_id: string | null;
    image_url: string | null;
    storage_path: string;
    position: number;
  }[] = [];
  try {
    let pos = 0;
    for (const item of items) {
      const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(item.path);
      const publicUrl = pub?.publicUrl;
      if (!publicUrl) continue;
      if (item.kind === "video") {
        const vid = await uploadAdVideo(integ.ad_account_id, token, publicUrl, "Pulse авто (сайт)");
        mediaToInsert.push({ kind: "video", meta_video_id: vid, image_url: null, storage_path: item.path, position: pos++ });
      } else {
        mediaToInsert.push({ kind: "image", meta_video_id: null, image_url: publicUrl, storage_path: item.path, position: pos++ });
      }
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Meta не приняла один из файлов" };
  }
  if (mediaToInsert.length === 0) return { ok: false, error: "Файлы не найдены в хранилище" };

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
      offer: offer || null,
      primary_text: copy.primaryText,
      headline: copy.headline,
      budget_usd: budget,
      status: "draft",
    })
    .select("id")
    .maybeSingle();
  if (error || !draft) return { ok: false, error: "Не удалось сохранить черновик" };

  const { error: mErr } = await admin
    .from("ad_launch_media")
    .insert(mediaToInsert.map((m) => ({ ...m, launch_id: draft.id })));
  if (mErr) return { ok: false, error: "Не удалось сохранить креативы" };

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

/* ─────────────── Запущенные кампании: список + анализ + действия ─────────────── */

export interface LaunchedCampaign {
  id: string;
  headline: string;
  createdAt: string;
  status: string; // active | paused
  budgetUsd: number;
  spend: number;
  leads: number;
  cpl: number;
  sales: number;
  revenueKzt: number;
  roas: number; // выручка / расход (в одной валюте)
  costPerSaleUsd: number;
  verdict: "good" | "ok" | "bad" | "early";
  canScale: boolean;
}

const GOOD_CPL = 3;
const NO_SALE_STOP_SPEND = 15; // потрачено столько без единой продажи — тревога

/** Вердикт кампании: если есть продажи — по окупаемости (ROAS), иначе по лидам/CPL. */
function campaignVerdict(o: {
  spend: number;
  leads: number;
  cpl: number;
  sales: number;
  roas: number;
}): LaunchedCampaign["verdict"] {
  if (o.spend < 3) return "early";
  if (o.sales > 0) {
    if (o.roas >= 2) return "good";
    if (o.roas >= 1) return "ok";
    return "bad";
  }
  // Продаж ещё нет
  if (o.spend >= NO_SALE_STOP_SPEND) return "bad";
  if (o.leads === 0 && o.spend >= 5) return "bad";
  if (o.leads > 0 && o.cpl <= GOOD_CPL) return "ok";
  return "ok";
}

/** Список запущенных авто-кампаний проекта с живыми расход/лиды/CPL из Meta. */
export async function getLaunchedCampaigns(projectId: string): Promise<LaunchedCampaign[]> {
  if (!(await canManage(projectId))) return [];
  const admin = createAdminClient();
  const { data: rows } = await admin
    .from("ad_launches")
    .select("id, headline, created_at, status, budget_usd, campaign_id, adset_id, purpose")
    .eq("project_id", projectId)
    .in("status", ["active", "paused"])
    .not("campaign_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(20);
  if (!rows || rows.length === 0) return [];

  // Курс ₸/$ и выручка по кампаниям (реклама → лид → продажа).
  const { data: proj } = await admin.from("projects").select("usd_rate").eq("id", projectId).maybeSingle();
  const usdRate = Number(proj?.usd_rate ?? 500);
  const campaignIds = rows.map((r) => r.campaign_id).filter((v): v is string => !!v);
  const revByCampaign = await getRevenueByCampaign(admin, projectId, campaignIds);

  const tokens = new Map<string, string | null>();
  async function tok(purpose: string): Promise<string | null> {
    if (tokens.has(purpose)) return tokens.get(purpose) ?? null;
    const { data } = await admin
      .from("meta_integration")
      .select("token_enc")
      .eq("project_id", projectId)
      .eq("purpose", purpose)
      .maybeSingle();
    let t: string | null = null;
    try {
      t = data?.token_enc ? decryptSecret(data.token_enc) : null;
    } catch {
      t = null;
    }
    tokens.set(purpose, t);
    return t;
  }

  const until = almatyYmd();
  const out: LaunchedCampaign[] = [];
  for (const r of rows) {
    const token = await tok(r.purpose);

    // Синхронизация статуса с Meta (мог удалить/остановить вручную)
    let liveStatus = r.status;
    if (token && r.campaign_id) {
      const synced = await fetchCampaignSyncStatus(token, r.campaign_id);
      if (synced !== r.status) {
        await admin.from("ad_launches").update({ status: synced }).eq("id", r.id);
        liveStatus = synced;
      }
    }
    if (liveStatus === "canceled") continue; // удалена в Meta — не показываем

    let spend = 0;
    let leads = 0;
    if (token && r.campaign_id) {
      try {
        const s = await fetchCampaignInsights(token, r.campaign_id, String(r.created_at).slice(0, 10), until);
        spend = s.spend;
        leads = s.leads;
      } catch {
        // статистика не критична — покажем 0
      }
    }
    const cpl = leads > 0 ? spend / leads : 0;
    const rev = (r.campaign_id && revByCampaign.get(r.campaign_id)) || { sales: 0, revenue: 0 };
    const spendKzt = spend * usdRate;
    const roas = spendKzt > 0 ? rev.revenue / spendKzt : 0;
    const costPerSaleUsd = rev.sales > 0 ? spend / rev.sales : 0;
    const verdict = campaignVerdict({ spend, leads, cpl, sales: rev.sales, roas });
    out.push({
      id: r.id,
      headline: r.headline ?? "Авто-кампания",
      createdAt: r.created_at,
      status: liveStatus,
      budgetUsd: Number(r.budget_usd),
      spend,
      leads,
      cpl,
      sales: rev.sales,
      revenueKzt: rev.revenue,
      roas,
      costPerSaleUsd,
      verdict,
      canScale: liveStatus === "active" && !!r.adset_id,
    });
  }
  return out;
}

export async function raiseLaunchBudget(projectId: string, launchId: string): Promise<{ ok: boolean; error?: string }> {
  if (!(await canManage(projectId))) return { ok: false, error: "Недостаточно прав" };
  const admin = createAdminClient();
  const { data: l } = await admin
    .from("ad_launches")
    .select("adset_id, purpose, budget_usd")
    .eq("id", launchId)
    .eq("project_id", projectId)
    .maybeSingle();
  if (!l?.adset_id) return { ok: false, error: "Нет группы объявлений" };
  const { data: integ } = await admin
    .from("meta_integration")
    .select("token_enc")
    .eq("project_id", projectId)
    .eq("purpose", l.purpose)
    .maybeSingle();
  if (!integ) return { ok: false, error: "Кабинет не подключён" };
  const newBudget = Math.round(Number(l.budget_usd ?? 3) * 1.5 * 100) / 100;
  try {
    await updateAdSetBudget(decryptSecret(integ.token_enc), l.adset_id, Math.round(newBudget * 100));
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Meta отклонила изменение" };
  }
  await admin.from("ad_launches").update({ budget_usd: newBudget, raise_suggested: false }).eq("id", launchId);
  revalidatePath(`/p/${projectId}/ads`);
  return { ok: true };
}

export async function stopLaunch(projectId: string, launchId: string): Promise<{ ok: boolean; error?: string }> {
  if (!(await canManage(projectId))) return { ok: false, error: "Недостаточно прав" };
  const admin = createAdminClient();
  const { data: l } = await admin
    .from("ad_launches")
    .select("campaign_id, purpose")
    .eq("id", launchId)
    .eq("project_id", projectId)
    .maybeSingle();
  if (!l?.campaign_id) return { ok: false, error: "Кампания не найдена" };
  const { data: integ } = await admin
    .from("meta_integration")
    .select("token_enc")
    .eq("project_id", projectId)
    .eq("purpose", l.purpose)
    .maybeSingle();
  if (!integ) return { ok: false, error: "Кабинет не подключён" };
  try {
    await pauseCampaign(decryptSecret(integ.token_enc), l.campaign_id);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Meta отклонила" };
  }
  await admin.from("ad_launches").update({ status: "paused" }).eq("id", launchId);
  revalidatePath(`/p/${projectId}/ads`);
  return { ok: true };
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
