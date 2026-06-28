/**
 * «Живые» данные рекламы из Meta за выбранный период (server-only).
 * Тянутся прямо при рендере страницы по диапазону дат — без ручной синхронизации.
 * Токен расшифровывается на сервере и наружу не уходит.
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptSecret } from "@/lib/crypto";
import { fetchMetaEntities, fetchAdCreatives, guessObjective, type AdLevel } from "@/lib/meta";
import type { CampaignRow } from "@/components/campaigns-table";

export interface AdThumb {
  thumb: string | null;
  full: string | null;
}

/**
 * Миниатюры креативов по ad_id (для «Аналитики креативов»).
 * Отдельно от getLiveAds, чтобы не замедлять «Рекламу»/«Финансы».
 */
export async function getAdThumbnails(projectId: string): Promise<Map<string, AdThumb>> {
  const admin = createAdminClient();
  const { data: integs } = await admin
    .from("meta_integration")
    .select("ad_account_id, token_enc")
    .eq("project_id", projectId);

  const map = new Map<string, AdThumb>();
  if (!integs || integs.length === 0) return map;

  for (const ig of integs) {
    try {
      const token = decryptSecret(ig.token_enc);
      const creatives = await fetchAdCreatives(ig.ad_account_id, token);
      for (const c of creatives) map.set(c.adId, { thumb: c.thumbUrl, full: c.fullUrl });
    } catch {
      // превью не критичны для раздела
    }
  }
  return map;
}

export interface LiveAds {
  /** Есть ли хотя бы один подключённый кабинет. */
  connected: boolean;
  /** Сущности за период (в нативной валюте кабинета, обычно USD). */
  campaigns: (CampaignRow & { objective: string })[];
  errors: string[];
}

export async function getLiveAds(
  projectId: string,
  level: AdLevel,
  since: string,
  until: string,
): Promise<LiveAds> {
  const admin = createAdminClient();
  const { data: integs } = await admin
    .from("meta_integration")
    .select("purpose, ad_account_id, token_enc")
    .eq("project_id", projectId);

  if (!integs || integs.length === 0) {
    return { connected: false, campaigns: [], errors: [] };
  }

  const campaigns: (CampaignRow & { objective: string })[] = [];
  const errors: string[] = [];

  for (const ig of integs) {
    const cabinetPurpose = ig.purpose === "vacancy" ? "vacancy" : "course";
    try {
      const token = decryptSecret(ig.token_enc);
      const camps = await fetchMetaEntities(ig.ad_account_id, token, level, since, until);
      for (const c of camps) {
        // Кабинет «Вакансии» → всё вакансии; кабинет «Курс» → делим по названию
        // (вакан/VAC/vacancy → вакансии, иначе курс).
        const objective = cabinetPurpose === "vacancy" ? "vacancy" : guessObjective(c.name);
        campaigns.push({
          id: c.externalId || `${objective}-${c.name}`,
          name: c.name,
          objective,
          status: c.status,
          spend: c.spend,
          impressions: c.impressions,
          clicks: c.clicks,
          reach: c.reach,
          leads: c.leads,
        });
      }
      await admin
        .from("meta_integration")
        .update({ status: "connected", last_error: null, last_synced_at: new Date().toISOString() })
        .eq("project_id", projectId)
        .eq("purpose", ig.purpose);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "ошибка";
      errors.push(`${cabinetPurpose === "vacancy" ? "Вакансии" : "Курс"}: ${msg}`);
      await admin
        .from("meta_integration")
        .update({ status: "error", last_error: msg })
        .eq("project_id", projectId)
        .eq("purpose", ig.purpose);
    }
  }

  campaigns.sort((a, b) => b.spend - a.spend);
  return { connected: true, campaigns, errors };
}
