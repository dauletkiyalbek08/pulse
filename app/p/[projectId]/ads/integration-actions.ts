"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEffectiveRole } from "@/lib/queries";
import { encryptSecret, decryptSecret } from "@/lib/crypto";
import { verifyMetaAccount, fetchMetaInsights, fetchMetaCampaigns } from "@/lib/meta";

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
  kztRate: number,
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

  const rate = account.currency === "KZT" ? 1 : kztRate > 0 ? kztRate : 1;

  const admin = createAdminClient();
  const { error } = await admin.from("meta_integration").upsert(
    {
      project_id: projectId,
      purpose: purposeOf(purpose),
      ad_account_id: adAccountId.replace(/^act_/, "").trim(),
      token_enc,
      currency: account.currency,
      kzt_rate: rate,
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
    .select("ad_account_id, token_enc, kzt_rate")
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

  const rate = Number(integ.kzt_rate) || 1;
  const inserts = rows
    .filter((r) => r.spend > 0 || r.leads > 0)
    .map((r) => ({
      project_id: projectId,
      channel: "meta",
      objective, // цель определяется кабинетом, а не названием
      campaign: r.campaign,
      amount: Math.round(r.spend * rate),
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
          spend: Math.round(c.spend * rate),
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
