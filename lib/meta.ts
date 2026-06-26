/**
 * Клиент Meta Marketing API (Graph API). Только сервер: токен сюда передаётся
 * уже расшифрованным и наружу не уходит. Тянем расходы и лиды по дням/кампаниям.
 */

const GRAPH = "https://graph.facebook.com/v23.0";

/** Типы действий, которые считаем «лидом» (lead ads, формы, Pixel). */
const LEAD_ACTION_TYPES = new Set([
  "lead",
  "leadgen.other",
  "leadgen_grouped",
  "onsite_conversion.lead_grouped",
  "offsite_conversion.fb_pixel_lead",
  "onsite_web_lead",
]);

export interface MetaAccount {
  name: string;
  currency: string;
  status: number;
}

interface GraphError {
  error?: { message?: string };
}

/** Нормализуем ad account id: "act_123" → "123". */
function accountNumber(id: string): string {
  return id.replace(/^act_/, "").trim();
}

/** Проверка доступа к кабинету: возвращает имя/валюту или бросает понятную ошибку. */
export async function verifyMetaAccount(adAccountId: string, token: string): Promise<MetaAccount> {
  const id = accountNumber(adAccountId);
  const url = `${GRAPH}/act_${id}?fields=name,currency,account_status&access_token=${encodeURIComponent(token)}`;
  const res = await fetch(url, { cache: "no-store" });
  const json = (await res.json()) as GraphError & {
    name?: string;
    currency?: string;
    account_status?: number;
  };
  if (!res.ok || json.error) {
    throw new Error(json.error?.message ?? "Не удалось подключиться к кабинету Meta");
  }
  return {
    name: json.name ?? id,
    currency: json.currency ?? "USD",
    status: json.account_status ?? 0,
  };
}

export interface MetaDayRow {
  date: string; // YYYY-MM-DD
  campaign: string;
  spend: number; // в валюте кабинета
  leads: number;
}

interface InsightsRow {
  date_start: string;
  campaign_name?: string;
  spend?: string;
  actions?: { action_type: string; value: string }[];
}
interface InsightsResponse {
  data?: InsightsRow[];
  paging?: { next?: string };
  error?: { message?: string };
}

/** Расходы и лиды по кампаниям и дням за период [since, until] (включительно). */
export async function fetchMetaInsights(
  adAccountId: string,
  token: string,
  since: string,
  until: string,
): Promise<MetaDayRow[]> {
  const id = accountNumber(adAccountId);
  const timeRange = encodeURIComponent(JSON.stringify({ since, until }));
  let url =
    `${GRAPH}/act_${id}/insights` +
    `?level=campaign&fields=campaign_name,spend,actions` +
    `&time_increment=1&time_range=${timeRange}&limit=200` +
    `&access_token=${encodeURIComponent(token)}`;

  const rows: MetaDayRow[] = [];
  // Пагинация (на всякий случай ограничим число страниц)
  for (let page = 0; page < 50 && url; page++) {
    const res = await fetch(url, { cache: "no-store" });
    const json = (await res.json()) as InsightsResponse;
    if (!res.ok || json.error) {
      throw new Error(json.error?.message ?? "Ошибка запроса к Meta Insights");
    }
    for (const r of json.data ?? []) {
      const leads = (r.actions ?? [])
        .filter((a) => LEAD_ACTION_TYPES.has(a.action_type))
        .reduce((s, a) => s + Number(a.value || 0), 0);
      rows.push({
        date: r.date_start,
        campaign: r.campaign_name ?? "Meta кампания",
        spend: Number(r.spend || 0),
        leads: Math.round(leads),
      });
    }
    url = json.paging?.next ?? "";
  }
  return rows;
}

/** Эвристика цели кампании по названию: вакансии vs курс. */
export function guessObjective(campaign: string): "course" | "vacancy" {
  return /вакан|ваканс|hr|job|рекрут|hiring|резюме|сотрудн/i.test(campaign) ? "vacancy" : "course";
}

export interface MetaCampaign {
  externalId: string;
  name: string;
  metaObjective: string;
  status: string; // active | paused | archived
  spend: number;
  impressions: number;
  clicks: number;
  reach: number;
  leads: number;
}

interface CampaignInsightRow {
  campaign_id?: string;
  campaign_name?: string;
  objective?: string;
  spend?: string;
  impressions?: string;
  clicks?: string;
  reach?: string;
  actions?: { action_type: string; value: string }[];
}

function mapStatus(effective?: string): string {
  if (effective === "ACTIVE") return "active";
  if (effective === "PAUSED" || effective === "CAMPAIGN_PAUSED" || effective === "ADSET_PAUSED")
    return "paused";
  return "archived";
}

/** Кампании кабинета с метриками за период (для раздела «Кампании»). */
export async function fetchMetaCampaigns(
  adAccountId: string,
  token: string,
  since: string,
  until: string,
): Promise<MetaCampaign[]> {
  const id = accountNumber(adAccountId);
  const timeRange = encodeURIComponent(JSON.stringify({ since, until }));

  // Статусы кампаний (отдельный edge — insights их не отдаёт)
  const statusById = new Map<string, string>();
  try {
    const sres = await fetch(
      `${GRAPH}/act_${id}/campaigns?fields=id,effective_status&limit=500&access_token=${encodeURIComponent(token)}`,
      { next: { revalidate: 120 } },
    );
    const sjson = (await sres.json()) as { data?: { id: string; effective_status?: string }[] };
    for (const c of sjson.data ?? []) statusById.set(c.id, mapStatus(c.effective_status));
  } catch {
    // статус не критичен — оставим 'active' по умолчанию
  }

  let url =
    `${GRAPH}/act_${id}/insights` +
    `?level=campaign&fields=campaign_id,campaign_name,objective,spend,impressions,clicks,reach,actions` +
    `&time_range=${timeRange}&limit=200&access_token=${encodeURIComponent(token)}`;

  const out: MetaCampaign[] = [];
  for (let page = 0; page < 50 && url; page++) {
    const res = await fetch(url, { next: { revalidate: 120 } });
    const json = (await res.json()) as {
      data?: CampaignInsightRow[];
      paging?: { next?: string };
      error?: { message?: string };
    };
    if (!res.ok || json.error) throw new Error(json.error?.message ?? "Ошибка запроса кампаний Meta");
    for (const r of json.data ?? []) {
      const leads = (r.actions ?? [])
        .filter((a) => LEAD_ACTION_TYPES.has(a.action_type))
        .reduce((s, a) => s + Number(a.value || 0), 0);
      out.push({
        externalId: r.campaign_id ?? "",
        name: r.campaign_name ?? "Кампания",
        metaObjective: r.objective ?? "",
        status: statusById.get(r.campaign_id ?? "") ?? "active",
        spend: Number(r.spend || 0),
        impressions: Number(r.impressions || 0),
        clicks: Number(r.clicks || 0),
        reach: Number(r.reach || 0),
        leads: Math.round(leads),
      });
    }
    url = json.paging?.next ?? "";
  }
  return out;
}
