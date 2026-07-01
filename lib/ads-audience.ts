/**
 * Разбивка рекламной аудитории по региону, возрасту и полу за период (Meta).
 * Только кампании «курс», суммы в долларах. Server-only.
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptSecret } from "@/lib/crypto";
import { fetchMetaBreakdown, guessObjective, type MetaBreakdownRow } from "@/lib/meta";

export interface AudienceBucket {
  label: string;
  leads: number;
  spendUsd: number;
  impressions: number;
  cpl: number | null; // $ за лид
}

export interface AudienceBreakdown {
  connected: boolean;
  byRegion: AudienceBucket[];
  byAge: AudienceBucket[];
  byGender: AudienceBucket[];
  errors: string[];
}

const GENDER_RU: Record<string, string> = {
  male: "Мужчины",
  female: "Женщины",
  unknown: "Не указан",
};

interface Agg {
  leads: number;
  spend: number;
  impressions: number;
}

function toBuckets(map: Map<string, Agg>, rename?: (k: string) => string): AudienceBucket[] {
  return [...map.entries()]
    .map(([key, a]) => ({
      label: rename ? rename(key) : key,
      leads: a.leads,
      spendUsd: a.spend,
      impressions: a.impressions,
      cpl: a.leads > 0 ? a.spend / a.leads : null,
    }))
    .sort((x, y) => y.leads - x.leads || y.spendUsd - x.spendUsd);
}

function add(map: Map<string, Agg>, key: string | undefined, r: MetaBreakdownRow) {
  const k = (key ?? "").trim() || "—";
  const a = map.get(k) ?? { leads: 0, spend: 0, impressions: 0 };
  a.leads += r.leads;
  a.spend += r.spend;
  a.impressions += r.impressions;
  map.set(k, a);
}

export async function getAudienceBreakdown(
  projectId: string,
  since: string,
  until: string,
): Promise<AudienceBreakdown> {
  const admin = createAdminClient();
  const { data: integs } = await admin
    .from("meta_integration")
    .select("purpose, ad_account_id, token_enc")
    .eq("project_id", projectId);

  if (!integs || integs.length === 0) {
    return { connected: false, byRegion: [], byAge: [], byGender: [], errors: [] };
  }

  const region = new Map<string, Agg>();
  const age = new Map<string, Agg>();
  const gender = new Map<string, Agg>();
  const errors: string[] = [];

  for (const ig of integs) {
    if (ig.purpose === "vacancy") continue; // РНП/аудитория — только курс
    try {
      const token = decryptSecret(ig.token_enc);
      // age+gender одним запросом, region — отдельным
      const [ag, reg] = await Promise.all([
        fetchMetaBreakdown(ig.ad_account_id, token, since, until, "age,gender"),
        fetchMetaBreakdown(ig.ad_account_id, token, since, until, "region"),
      ]);
      for (const r of ag) {
        if (guessObjective(r.campaign) !== "course") continue;
        add(age, r.age, r);
        add(gender, r.gender, r);
      }
      for (const r of reg) {
        if (guessObjective(r.campaign) !== "course") continue;
        add(region, r.region, r);
      }
    } catch (e) {
      errors.push(e instanceof Error ? e.message : "ошибка Meta");
    }
  }

  return {
    connected: true,
    byRegion: toBuckets(region),
    byAge: toBuckets(age),
    byGender: toBuckets(gender, (k) => GENDER_RU[k] ?? k),
    errors,
  };
}
