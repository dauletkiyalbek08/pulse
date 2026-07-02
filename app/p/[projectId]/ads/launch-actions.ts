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
  pauseAd,
  fetchCampaignAdIds,
  setAdUrlTags,
} from "@/lib/meta-launch";
import { fetchAdInsightsForCampaign, fetchCampaignSyncStatus, type AdInsight } from "@/lib/meta";
import { getRevenueByCampaign, getRevenueByAd } from "@/lib/ad-revenue";
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

/**
 * Включить авто-привязку креативов на уже запущенных кампаниях: проставляет
 * метки url_tags на все их объявления в Meta. После этого новые клики по
 * рекламе автоматически привязывают лид к конкретному креативу (ROAS по креативу).
 * Одноразовое действие; повторный вызов безопасен (просто перезапишет метки).
 */
export async function enableAttributionOnLive(projectId: string): Promise<{ ok: boolean; ads?: number; error?: string }> {
  if (!(await canManage(projectId))) return { ok: false, error: "Недостаточно прав" };
  const admin = createAdminClient();
  const { data: rows } = await admin
    .from("ad_launches")
    .select("campaign_id, purpose")
    .eq("project_id", projectId)
    .in("status", ["active", "paused"])
    .not("campaign_id", "is", null);
  if (!rows || rows.length === 0) return { ok: true, ads: 0 };

  const tokenCache = new Map<string, string | null>();
  async function tok(purpose: string): Promise<string | null> {
    if (tokenCache.has(purpose)) return tokenCache.get(purpose) ?? null;
    const t = await tokenForLaunch(admin, projectId, purpose);
    tokenCache.set(purpose, t);
    return t;
  }

  let count = 0;
  for (const r of rows) {
    if (!r.campaign_id) continue;
    const token = await tok(r.purpose);
    if (!token) continue;
    try {
      const adIds = await fetchCampaignAdIds(token, r.campaign_id);
      for (const adId of adIds) {
        try {
          await setAdUrlTags(token, adId);
          count += 1;
        } catch {
          // отдельное объявление могло не принять — продолжаем
        }
      }
    } catch {
      // кампания недоступна — пропускаем
    }
  }
  revalidatePath(`/p/${projectId}/ads`);
  return { ok: true, ads: count };
}

/* ─────────────── Итоги с рекламы (CRM: лиды/продажи/выручка) ─────────────── */

// Источники лидов, которые считаем «рекламными».
const AD_SOURCES = ["site", "facebook", "meta", "instagram", "tiktok"];

export interface AdCrmTotals {
  leads: number;
  sales: number;
  revenueKzt: number;
  usdRate: number;
}

/**
 * Итоги с рекламы из CRM за период (по умолчанию 30 дней): сколько пришло
 * лидов с рекламных источников и сколько из них купили (выручка ₸).
 * Считает ВСЕ такие продажи, даже без привязки к конкретной кампании/креативу.
 */
export async function getAdCrmTotals(projectId: string, days = 30): Promise<AdCrmTotals> {
  const empty: AdCrmTotals = { leads: 0, sales: 0, revenueKzt: 0, usdRate: 500 };
  if (!(await canManage(projectId))) return empty;
  const admin = createAdminClient();

  const { data: proj } = await admin.from("projects").select("usd_rate").eq("id", projectId).maybeSingle();
  const usdRate = Number(proj?.usd_rate ?? 500);

  const since = new Date(Date.now() - days * 86400000).toISOString();
  const { data: leads } = await admin
    .from("leads")
    .select("id")
    .eq("project_id", projectId)
    .in("source", AD_SOURCES)
    .gte("created_at", since);

  const leadIds = (leads ?? []).map((l) => l.id);
  let sales = 0;
  let revenueKzt = 0;
  if (leadIds.length > 0) {
    const { data: s } = await admin
      .from("sales")
      .select("amount")
      .eq("project_id", projectId)
      .in("lead_id", leadIds);
    sales = s?.length ?? 0;
    revenueKzt = (s ?? []).reduce((a, r) => a + (Number(r.amount) || 0), 0);
  }

  return { leads: leads?.length ?? 0, sales, revenueKzt, usdRate };
}

export interface UnattributedLead {
  leadId: string;
  name: string;
  createdAt: string;
  saleAmount: number; // 0 — если продажи ещё нет
}

/**
 * Рекламные лиды БЕЗ привязки к кампании (для ручной привязки владельцем/директором).
 * Покупатели — вперёд. Обычно это заходы до включения авто-меток или прямые визиты.
 */
export async function getUnattributedAdLeads(projectId: string, days = 60): Promise<UnattributedLead[]> {
  if (!(await canManage(projectId))) return [];
  const admin = createAdminClient();
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const { data: leads } = await admin
    .from("leads")
    .select("id, full_name, created_at")
    .eq("project_id", projectId)
    .in("source", AD_SOURCES)
    .is("campaign_id", null)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(50);
  if (!leads || leads.length === 0) return [];

  const ids = leads.map((l) => l.id);
  const { data: sales } = await admin.from("sales").select("lead_id, amount").eq("project_id", projectId).in("lead_id", ids);
  const amt = new Map<string, number>();
  for (const s of sales ?? []) {
    if (s.lead_id) amt.set(s.lead_id, (amt.get(s.lead_id) ?? 0) + (Number(s.amount) || 0));
  }

  return leads
    .map((l) => ({ leadId: l.id, name: l.full_name, createdAt: l.created_at, saleAmount: amt.get(l.id) ?? 0 }))
    .sort((a, b) => (b.saleAmount > 0 ? 1 : 0) - (a.saleAmount > 0 ? 1 : 0));
}

/** Привязать лид (и его продажу) к кампании — заполняет campaign_id/adset_id лида. */
export async function attributeLeadToCampaign(
  projectId: string,
  leadId: string,
  launchId: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!(await canManage(projectId))) return { ok: false, error: "Недостаточно прав" };
  const admin = createAdminClient();
  const { data: l } = await admin
    .from("ad_launches")
    .select("campaign_id, adset_id")
    .eq("id", launchId)
    .eq("project_id", projectId)
    .maybeSingle();
  if (!l?.campaign_id) return { ok: false, error: "Кампания не найдена" };
  const { error } = await admin
    .from("leads")
    .update({ campaign_id: l.campaign_id, adset_id: l.adset_id })
    .eq("id", leadId)
    .eq("project_id", projectId);
  if (error) return { ok: false, error: "Не удалось привязать" };
  revalidatePath(`/p/${projectId}/ads`);
  return { ok: true };
}

/* ─────────────── Запущенные кампании: список + анализ + действия ─────────────── */

type Verdict = "good" | "ok" | "bad" | "early";

export interface CreativeStat {
  adId: string;
  kind: string; // video | image
  thumb: string | null;
  spend: number;
  leads: number;
  cpl: number;
  sales: number;
  revenueKzt: number;
  roas: number;
  verdict: Verdict;
  isWinner: boolean;
}

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
  verdict: Verdict;
  canScale: boolean;
  creatives: CreativeStat[];
}

const GOOD_CPL = 3;
const NO_SALE_STOP_SPEND = 15; // потрачено столько без единой продажи — тревога

/** Вердикт одного креатива (пороги мягче: бюджеты меньше кампании). */
function creativeVerdict(o: { spend: number; leads: number; cpl: number; sales: number; roas: number }): Verdict {
  if (o.spend < 1) return "early";
  if (o.sales > 0) return o.roas >= 2 ? "good" : o.roas >= 1 ? "ok" : "bad";
  if (o.leads > 0 && o.cpl <= GOOD_CPL) return "good";
  if (o.leads === 0 && o.spend >= 3) return "bad";
  return "ok";
}

/** Помечает лучший креатив (по продажам → ROAS → лидам → дешевизне лида). */
function flagWinner(list: CreativeStat[]): void {
  const ranked = list.filter((c) => c.spend > 0 && (c.sales > 0 || c.leads > 0));
  if (list.length < 2 || ranked.length === 0) return;
  ranked.sort(
    (a, b) =>
      b.sales - a.sales ||
      b.roas - a.roas ||
      b.leads - a.leads ||
      (a.cpl || Infinity) - (b.cpl || Infinity),
  );
  ranked[0].isWinner = true;
}

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

  // Креативы всех кампаний одним запросом + выручка по объявлениям.
  const launchIds = rows.map((r) => r.id);
  const { data: mediaRows } = await admin
    .from("ad_launch_media")
    .select("launch_id, kind, thumb_url, image_url, meta_ad_id, position")
    .in("launch_id", launchIds)
    .order("position", { ascending: true });
  const mediaByLaunch = new Map<string, NonNullable<typeof mediaRows>>();
  for (const m of mediaRows ?? []) {
    const arr = mediaByLaunch.get(m.launch_id) ?? [];
    arr.push(m);
    mediaByLaunch.set(m.launch_id, arr);
  }
  const allAdIds = (mediaRows ?? []).map((m) => m.meta_ad_id).filter((v): v is string => !!v);
  const revByAd = await getRevenueByAd(admin, projectId, allAdIds);

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

    // Инсайты по объявлениям (сумма = итог кампании, плюс разбивка по креативам).
    let adInsights: AdInsight[] = [];
    if (token && r.campaign_id) {
      try {
        adInsights = await fetchAdInsightsForCampaign(token, r.campaign_id, String(r.created_at).slice(0, 10), until);
      } catch {
        // статистика не критична — покажем 0
      }
    }
    const insightByAd = new Map(adInsights.map((a) => [a.adId, a]));
    const spend = adInsights.reduce((s, a) => s + a.spend, 0);
    const leads = adInsights.reduce((s, a) => s + a.leads, 0);

    const cpl = leads > 0 ? spend / leads : 0;
    const rev = (r.campaign_id && revByCampaign.get(r.campaign_id)) || { sales: 0, revenue: 0 };
    const spendKzt = spend * usdRate;
    const roas = spendKzt > 0 ? rev.revenue / spendKzt : 0;
    const costPerSaleUsd = rev.sales > 0 ? spend / rev.sales : 0;
    const verdict = campaignVerdict({ spend, leads, cpl, sales: rev.sales, roas });

    // Разбивка по креативам.
    const creatives: CreativeStat[] = (mediaByLaunch.get(r.id) ?? [])
      .filter((m) => m.meta_ad_id)
      .map((m) => {
        const ins = insightByAd.get(m.meta_ad_id as string) ?? { spend: 0, leads: 0 };
        const cr = revByAd.get(m.meta_ad_id as string) ?? { sales: 0, revenue: 0 };
        const cCpl = ins.leads > 0 ? ins.spend / ins.leads : 0;
        const cRoas = ins.spend * usdRate > 0 ? cr.revenue / (ins.spend * usdRate) : 0;
        return {
          adId: m.meta_ad_id as string,
          kind: m.kind,
          thumb: m.thumb_url ?? m.image_url ?? null,
          spend: ins.spend,
          leads: ins.leads,
          cpl: cCpl,
          sales: cr.sales,
          revenueKzt: cr.revenue,
          roas: cRoas,
          verdict: creativeVerdict({ spend: ins.spend, leads: ins.leads, cpl: cCpl, sales: cr.sales, roas: cRoas }),
          isWinner: false,
        };
      });
    flagWinner(creatives);

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
      creatives,
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

/** Токен кабинета проекта по назначению кампании (course/vacancy). */
async function tokenForLaunch(
  admin: ReturnType<typeof createAdminClient>,
  projectId: string,
  purpose: string,
): Promise<string | null> {
  const { data } = await admin
    .from("meta_integration")
    .select("token_enc")
    .eq("project_id", projectId)
    .eq("purpose", purpose)
    .maybeSingle();
  try {
    return data?.token_enc ? decryptSecret(data.token_enc) : null;
  } catch {
    return null;
  }
}

/** Остановить один креатив (объявление) кампании. */
export async function stopCreative(
  projectId: string,
  launchId: string,
  adId: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!(await canManage(projectId))) return { ok: false, error: "Недостаточно прав" };
  const admin = createAdminClient();
  const { data: l } = await admin
    .from("ad_launches")
    .select("purpose")
    .eq("id", launchId)
    .eq("project_id", projectId)
    .maybeSingle();
  if (!l) return { ok: false, error: "Кампания не найдена" };
  const token = await tokenForLaunch(admin, projectId, l.purpose);
  if (!token) return { ok: false, error: "Кабинет не подключён" };
  try {
    await pauseAd(token, adId);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Meta отклонила" };
  }
  revalidatePath(`/p/${projectId}/ads`);
  return { ok: true };
}

/** Оставить только лучший креатив: остальные в кампании — на паузу. */
export async function keepBestCreative(
  projectId: string,
  launchId: string,
): Promise<{ ok: boolean; error?: string; paused?: number }> {
  if (!(await canManage(projectId))) return { ok: false, error: "Недостаточно прав" };
  const admin = createAdminClient();
  const list = await getLaunchedCampaigns(projectId);
  const camp = list.find((c) => c.id === launchId);
  if (!camp) return { ok: false, error: "Кампания не найдена" };
  const winner = camp.creatives.find((c) => c.isWinner);
  if (!winner) return { ok: false, error: "Победитель ещё не определён — мало данных" };

  const { data: l } = await admin
    .from("ad_launches")
    .select("purpose")
    .eq("id", launchId)
    .eq("project_id", projectId)
    .maybeSingle();
  const token = l ? await tokenForLaunch(admin, projectId, l.purpose) : null;
  if (!token) return { ok: false, error: "Кабинет не подключён" };

  let paused = 0;
  for (const c of camp.creatives) {
    if (c.adId === winner.adId) continue;
    try {
      await pauseAd(token, c.adId);
      paused += 1;
    } catch {
      // продолжаем — часть могла быть уже на паузе
    }
  }
  revalidatePath(`/p/${projectId}/ads`);
  return { ok: true, paused };
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
