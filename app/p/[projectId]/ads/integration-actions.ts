"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEffectiveRole } from "@/lib/queries";
import { encryptSecret, decryptSecret } from "@/lib/crypto";
import {
  verifyMetaAccount,
  fetchMetaInsights,
  fetchMetaCampaigns,
  fetchPages,
  fetchTokenPermissions,
} from "@/lib/meta";

const MANAGE_ROLES = ["owner", "director", "marketer", "targetologist"];

/** Назначение кабинета: курс или вакансии. */
export type AdPurpose = "course" | "vacancy";

export interface MetaStatus {
  purpose: AdPurpose;
  adAccountId: string;
  currency: string;
  kztRate: number;
  status: string;
  lastSyncedAt: string | null;
  lastError: string | null;
}

function purposeOf(v: string): AdPurpose {
  return v === "vacancy" ? "vacancy" : "course";
}

async function canManage(projectId: string): Promise<boolean> {
  const role = await getEffectiveRole(projectId);
  return !!role && MANAGE_ROLES.includes(role);
}

/** Статусы обоих кабинетов проекта (без токенов) — для отрисовки «Рекламы». */
export async function getMetaStatuses(projectId: string): Promise<MetaStatus[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("meta_integration")
    .select("purpose, ad_account_id, currency, kzt_rate, status, last_synced_at, last_error")
    .eq("project_id", projectId);
  return (data ?? []).map((d) => ({
    purpose: purposeOf(d.purpose),
    adAccountId: d.ad_account_id,
    currency: d.currency,
    kztRate: Number(d.kzt_rate),
    status: d.status,
    lastSyncedAt: d.last_synced_at,
    lastError: d.last_error,
  }));
}

export interface ConnectResult {
  ok: boolean;
  error?: string;
  name?: string;
  currency?: string;
}

export async function connectMeta(
  projectId: string,
  purpose: AdPurpose,
  adAccountId: string,
  token: string,
): Promise<ConnectResult> {
  if (!(await canManage(projectId))) return { ok: false, error: "Недостаточно прав" };
  if (!adAccountId.trim()) return { ok: false, error: "Укажите ID рекламного аккаунта" };
  if (!token.trim()) return { ok: false, error: "Укажите токен доступа" };

  let account;
  try {
    account = await verifyMetaAccount(adAccountId, token);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Не удалось проверить доступ" };
  }

  let token_enc: string;
  try {
    token_enc = encryptSecret(token.trim());
  } catch {
    return { ok: false, error: "Сервер не настроен (нет ключа шифрования)" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const admin = createAdminClient();
  const { error } = await admin.from("meta_integration").upsert(
    {
      project_id: projectId,
      purpose: purposeOf(purpose),
      ad_account_id: adAccountId.replace(/^act_/, "").trim(),
      token_enc,
      currency: account.currency,
      kzt_rate: 1,
      status: "connected",
      last_error: null,
      connected_by: user?.id ?? null,
    },
    { onConflict: "project_id,purpose" },
  );
  if (error) return { ok: false, error: "Не удалось сохранить подключение" };

  revalidatePath(`/p/${projectId}/ads`);
  return { ok: true, name: account.name, currency: account.currency };
}

export async function disconnectMeta(
  projectId: string,
  purpose: AdPurpose,
): Promise<{ ok: boolean }> {
  if (!(await canManage(projectId))) return { ok: false };
  const admin = createAdminClient();
  await admin
    .from("meta_integration")
    .delete()
    .eq("project_id", projectId)
    .eq("purpose", purposeOf(purpose));
  revalidatePath(`/p/${projectId}/ads`);
  return { ok: true };
}

/* ─────────────── Проверка прав токена (для автозапуска рекламы) ─────────────── */

/** Права, нужные боту-автозапуску: создавать кампании + видеть/использовать страницы. */
const REQUIRED_LAUNCH_SCOPES = [
  "ads_management",
  "pages_show_list",
  "pages_read_engagement",
] as const;

export interface MetaPermsResult {
  ok: boolean;
  error?: string;
  granted?: string[];
  missing?: string[];
  canLaunch?: boolean; // есть ads_management — главное право для создания кампаний
}

/**
 * Проверяет, какие права выданы токену подключённого кабинета `purpose`.
 * Ничего не создаёт — только читает /me/permissions. Токен наружу не уходит.
 */
export async function checkMetaPermissions(
  projectId: string,
  purpose: AdPurpose = "course",
): Promise<MetaPermsResult> {
  if (!(await canManage(projectId))) return { ok: false, error: "Недостаточно прав" };

  const admin = createAdminClient();
  const { data: integ } = await admin
    .from("meta_integration")
    .select("token_enc")
    .eq("project_id", projectId)
    .eq("purpose", purposeOf(purpose))
    .maybeSingle();
  if (!integ) return { ok: false, error: "Кабинет не подключён" };

  let granted: string[];
  try {
    granted = await fetchTokenPermissions(decryptSecret(integ.token_enc));
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Не удалось проверить права" };
  }

  const missing = REQUIRED_LAUNCH_SCOPES.filter((s) => !granted.includes(s));
  return {
    ok: true,
    granted,
    missing,
    canLaunch: granted.includes("ads_management"),
  };
}

/* ─────────────────── Конфиг автозапуска рекламы (из бота) ─────────────────── */

const SITE_BASE = "https://pulse-drab-chi.vercel.app";

export interface LaunchConfig {
  country: string;
  ageMin: number;
  ageMax: number;
  gender: string; // all|male|female
  dailyBudgetUsd: number;
  destinationUrl: string;
  pageId: string | null;
  objective: string; // traffic|leads
}

/** Текущий конфиг запуска (с дефолтами) + подсказка адреса квиза. */
export async function getLaunchConfig(
  projectId: string,
): Promise<{ config: LaunchConfig; defaultDestination: string }> {
  const admin = createAdminClient();
  const [cfgRes, landingRes] = await Promise.all([
    admin
      .from("ad_launch_config")
      .select("country, age_min, age_max, gender, daily_budget_usd, destination_url, page_id, objective")
      .eq("project_id", projectId)
      .maybeSingle(),
    admin
      .from("landings")
      .select("slug")
      .eq("project_id", projectId)
      .eq("type", "quiz")
      .eq("status", "active")
      .limit(1)
      .maybeSingle(),
  ]);

  const defaultDestination = landingRes.data?.slug
    ? `${SITE_BASE}/l/${landingRes.data.slug}`
    : `${SITE_BASE}/l/quiz`;
  const c = cfgRes.data;
  return {
    config: {
      country: c?.country ?? "KZ",
      ageMin: c?.age_min ?? 24,
      ageMax: c?.age_max ?? 55,
      gender: c?.gender ?? "all",
      dailyBudgetUsd: Number(c?.daily_budget_usd ?? 5),
      destinationUrl: c?.destination_url ?? defaultDestination,
      pageId: c?.page_id ?? null,
      objective: c?.objective ?? "traffic",
    },
    defaultDestination,
  };
}

export async function saveLaunchConfig(
  projectId: string,
  input: LaunchConfig,
): Promise<{ ok: boolean; error?: string }> {
  if (!(await canManage(projectId))) return { ok: false, error: "Недостаточно прав" };

  const ageMin = Math.max(13, Math.min(65, Math.round(input.ageMin)));
  const ageMax = Math.max(ageMin, Math.min(65, Math.round(input.ageMax)));
  const budget = Math.max(1, Number(input.dailyBudgetUsd) || 5);
  const gender = ["all", "male", "female"].includes(input.gender) ? input.gender : "all";
  const country = (input.country || "KZ").trim().toUpperCase().slice(0, 2);
  const destination = (input.destinationUrl || "").trim() || null;

  const admin = createAdminClient();
  const { error } = await admin.from("ad_launch_config").upsert(
    {
      project_id: projectId,
      country,
      age_min: ageMin,
      age_max: ageMax,
      gender,
      daily_budget_usd: budget,
      destination_url: destination,
      page_id: input.pageId || null,
      objective: input.objective === "leads" ? "leads" : "traffic",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "project_id" },
  );
  if (error) return { ok: false, error: "Не удалось сохранить настройки запуска" };

  revalidatePath(`/p/${projectId}/ads`);
  return { ok: true };
}

/* ───────────────────────── Lead Ads (формы) ───────────────────────── */

export interface LeadPage {
  pageId: string;
  name: string;
}

/** Список привязанных Facebook-страниц проекта (для Lead Ads). */
export async function getLeadPages(projectId: string): Promise<LeadPage[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("meta_pages")
    .select("page_id, name")
    .eq("project_id", projectId);
  return (data ?? []).map((p) => ({ pageId: p.page_id, name: p.name ?? p.page_id }));
}

export interface LinkPagesResult {
  ok: boolean;
  error?: string;
  count?: number;
}

/** Загрузить и привязать к проекту страницы, доступные подключённому кабинету. */
export async function linkLeadPages(projectId: string): Promise<LinkPagesResult> {
  if (!(await canManage(projectId))) return { ok: false, error: "Недостаточно прав" };

  const admin = createAdminClient();
  const { data: integ } = await admin
    .from("meta_integration")
    .select("purpose, token_enc")
    .eq("project_id", projectId);
  if (!integ || integ.length === 0) return { ok: false, error: "Сначала подключите кабинет Meta" };

  const row = integ.find((r) => r.purpose === "course") ?? integ[0];
  let pages;
  try {
    pages = await fetchPages(decryptSecret(row.token_enc));
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Не удалось получить страницы (нужны права pages_show_list)" };
  }
  if (pages.length === 0) return { ok: false, error: "У токена нет доступных страниц" };

  const { error } = await admin
    .from("meta_pages")
    .upsert(
      pages.map((p) => ({ page_id: p.id, project_id: projectId, name: p.name })),
      { onConflict: "page_id" },
    );
  if (error) return { ok: false, error: "Не удалось сохранить страницы" };

  revalidatePath(`/p/${projectId}/ads`);
  return { ok: true, count: pages.length };
}

export interface SyncResult {
  ok: boolean;
  error?: string;
  days?: number;
  campaigns?: number;
  total?: number;
  leads?: number;
}

/** Синхронизация одного кабинета (по назначению) за период → ad_spend + ad_campaigns. */
export async function syncMeta(
  projectId: string,
  purpose: AdPurpose,
  since: string,
  until: string,
): Promise<SyncResult> {
  if (!(await canManage(projectId))) return { ok: false, error: "Недостаточно прав" };
  const objective = purposeOf(purpose);

  const admin = createAdminClient();
  const { data: integ } = await admin
    .from("meta_integration")
    .select("ad_account_id, token_enc")
    .eq("project_id", projectId)
    .eq("purpose", objective)
    .maybeSingle();
  if (!integ) return { ok: false, error: "Кабинет не подключён" };

  let rows;
  try {
    const token = decryptSecret(integ.token_enc);
    rows = await fetchMetaInsights(integ.ad_account_id, token, since, until);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Ошибка синхронизации";
    await admin
      .from("meta_integration")
      .update({ status: "error", last_error: msg })
      .eq("project_id", projectId)
      .eq("purpose", objective);
    revalidatePath(`/p/${projectId}/ads`);
    return { ok: false, error: msg };
  }

  const inserts = rows
    .filter((r) => r.spend > 0 || r.leads > 0)
    .map((r) => ({
      project_id: projectId,
      channel: "meta",
      objective, // цель определяется кабинетом, а не названием
      campaign: r.campaign,
      amount: Math.round(r.spend * 100) / 100, // нативный USD
      currency: "USD",
      spent_on: r.date,
      leads: r.leads,
      source: "meta",
      note: null as string | null,
    }));

  // Идемпотентность по этому кабинету (objective) и периоду
  await admin
    .from("ad_spend")
    .delete()
    .eq("project_id", projectId)
    .eq("source", "meta")
    .eq("objective", objective)
    .gte("spent_on", since)
    .lte("spent_on", until);

  if (inserts.length > 0) {
    const { error } = await admin.from("ad_spend").insert(inserts);
    if (error) return { ok: false, error: "Не удалось записать расходы" };
  }

  // Снимок кампаний этого кабинета — best-effort
  try {
    const token = decryptSecret(integ.token_enc);
    const camps = await fetchMetaCampaigns(integ.ad_account_id, token, since, until);
    await admin
      .from("ad_campaigns")
      .delete()
      .eq("project_id", projectId)
      .eq("channel", "meta")
      .eq("objective", objective);
    if (camps.length > 0) {
      await admin.from("ad_campaigns").insert(
        camps.map((c) => ({
          project_id: projectId,
          channel: "meta",
          external_id: c.externalId,
          name: c.name,
          objective,
          meta_objective: c.metaObjective,
          status: c.status,
          spend: Math.round(c.spend * 100) / 100, // нативный USD
          currency: "USD",
          impressions: c.impressions,
          clicks: c.clicks,
          reach: c.reach,
          leads: c.leads,
          period_from: since,
          period_to: until,
        })),
      );
    }
  } catch {
    // снимок кампаний не критичен для синхронизации расходов
  }

  await admin
    .from("meta_integration")
    .update({ status: "connected", last_error: null, last_synced_at: new Date().toISOString() })
    .eq("project_id", projectId)
    .eq("purpose", objective);

  revalidatePath(`/p/${projectId}/ads`);
  revalidatePath(`/p/${projectId}/finance`);

  const total = inserts.reduce((s, r) => s + r.amount, 0);
  const leads = inserts.reduce((s, r) => s + r.leads, 0);
  const days = new Set(inserts.map((r) => r.spent_on)).size;
  return { ok: true, days, campaigns: inserts.length, total, leads };
}
