/**
 * Ежедневный отчёт по рекламе (РНП) для таргетолога — по дням за период.
 * Тянет дневную разбивку из Meta, оставляет только «курс», агрегирует по дате
 * и считает производные (CPL, CPM, CPC, CTR). Суммы — в долларах (валюта
 * кабинета Meta), как привык таргетолог. Server-only.
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptSecret } from "@/lib/crypto";
import { fetchMetaDaily, guessObjective } from "@/lib/meta";

export interface DailyAdRow {
  date: string; // YYYY-MM-DD
  spendUsd: number;
  impressions: number;
  clicks: number;
  reach: number;
  leads: number;
  cpl: number | null; // $ за лид
  cpm: number | null; // $ за 1000 показов
  cpc: number | null; // $ за клик
  ctr: number | null; // %
}

export interface DailyAdReport {
  connected: boolean;
  rows: DailyAdRow[]; // новые сверху
  totals: Omit<DailyAdRow, "date">;
  errors: string[];
}

interface Agg {
  spend: number;
  impressions: number;
  clicks: number;
  reach: number;
  leads: number;
}

function derive(spendUsd: number, a: Agg): Omit<DailyAdRow, "date"> {
  return {
    spendUsd,
    impressions: a.impressions,
    clicks: a.clicks,
    reach: a.reach,
    leads: a.leads,
    cpl: a.leads > 0 ? spendUsd / a.leads : null,
    cpm: a.impressions > 0 ? (spendUsd / a.impressions) * 1000 : null,
    cpc: a.clicks > 0 ? spendUsd / a.clicks : null,
    ctr: a.impressions > 0 ? (a.clicks / a.impressions) * 100 : null,
  };
}

export async function getDailyAdReport(
  projectId: string,
  since: string,
  until: string,
): Promise<DailyAdReport> {
  const admin = createAdminClient();
  const { data: integs } = await admin
    .from("meta_integration")
    .select("purpose, ad_account_id, token_enc")
    .eq("project_id", projectId);

  const empty: DailyAdReport = {
    connected: false,
    rows: [],
    totals: derive(0, { spend: 0, impressions: 0, clicks: 0, reach: 0, leads: 0 }),
    errors: [],
  };
  if (!integs || integs.length === 0) return empty;

  const byDate = new Map<string, Agg>();
  const errors: string[] = [];

  for (const ig of integs) {
    const isVacancy = ig.purpose === "vacancy";
    try {
      const token = decryptSecret(ig.token_enc);
      const days = await fetchMetaDaily(ig.ad_account_id, token, since, until);
      for (const d of days) {
        // Только реклама курса: кабинет вакансий пропускаем целиком,
        // в кабинете курса делим по названию кампании.
        const objective = isVacancy ? "vacancy" : guessObjective(d.campaign);
        if (objective !== "course") continue;
        const a = byDate.get(d.date) ?? { spend: 0, impressions: 0, clicks: 0, reach: 0, leads: 0 };
        a.spend += d.spend;
        a.impressions += d.impressions;
        a.clicks += d.clicks;
        a.reach += d.reach;
        a.leads += d.leads;
        byDate.set(d.date, a);
      }
    } catch (e) {
      errors.push(e instanceof Error ? e.message : "ошибка Meta");
    }
  }

  const rows: DailyAdRow[] = [...byDate.entries()]
    .map(([date, a]) => ({ date, ...derive(a.spend, a) }))
    .sort((x, y) => (x.date < y.date ? 1 : -1));

  const sum: Agg = { spend: 0, impressions: 0, clicks: 0, reach: 0, leads: 0 };
  for (const a of byDate.values()) {
    sum.spend += a.spend;
    sum.impressions += a.impressions;
    sum.clicks += a.clicks;
    sum.reach += a.reach;
    sum.leads += a.leads;
  }

  return {
    connected: true,
    rows,
    totals: derive(sum.spend, sum),
    errors,
  };
}
