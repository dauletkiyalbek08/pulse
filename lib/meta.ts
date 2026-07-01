/**
 * Клиент Meta Marketing API (Graph API). Только сервер: токен сюда передаётся
 * уже расшифрованным и наружу не уходит. Тянем расходы и лиды по дням/кампаниям.
 */

const GRAPH = "https://graph.facebook.com/v23.0";

/**
 * Лиды: Meta в `actions` отдаёт один и тот же лид под разными именами
 * (`lead` == `onsite_conversion.lead_grouped`). Поэтому НЕ суммируем, а берём
 * ОДИН канонический показатель по приоритету (как «Результат» в Ads Manager).
 */
const LEAD_PRIORITY = [
  "lead",
  "onsite_conversion.lead_grouped",
  "leadgen_grouped",
  "leadgen.other",
  "offsite_conversion.fb_pixel_lead",
  "onsite_web_lead",
];

function pickLeads(actions?: { action_type: string; value: string }[]): number {
  if (!actions) return 0;
  for (const t of LEAD_PRIORITY) {
    const found = actions.find((a) => a.action_type === t);
    if (found) return Math.round(Number(found.value || 0));
  }
  return 0;
}

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
      const leads = pickLeads(r.actions);
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

export interface MetaDayFull {
  date: string; // YYYY-MM-DD
  campaign: string;
  spend: number; // валюта кабинета
  impressions: number;
  clicks: number;
  reach: number;
  leads: number;
}

/**
 * Дневная разбивка по кампаниям с показами/кликами/охватом/лидами —
 * для ежедневного отчёта таргетолога (РНП). time_increment=1 → строка на день.
 */
export async function fetchMetaDaily(
  adAccountId: string,
  token: string,
  since: string,
  until: string,
): Promise<MetaDayFull[]> {
  const id = accountNumber(adAccountId);
  const timeRange = encodeURIComponent(JSON.stringify({ since, until }));
  let url =
    `${GRAPH}/act_${id}/insights` +
    `?level=campaign&fields=campaign_name,spend,impressions,inline_link_clicks,reach,actions` +
    `&time_increment=1&time_range=${timeRange}&limit=300` +
    `&access_token=${encodeURIComponent(token)}`;

  const rows: MetaDayFull[] = [];
  for (let page = 0; page < 50 && url; page++) {
    const res = await fetch(url, { cache: "no-store" });
    const json = (await res.json()) as {
      data?: (InsightsRow & { impressions?: string; inline_link_clicks?: string; reach?: string })[];
      paging?: { next?: string };
      error?: { message?: string };
    };
    if (!res.ok || json.error) {
      throw new Error(json.error?.message ?? "Ошибка запроса к Meta Insights");
    }
    for (const r of json.data ?? []) {
      rows.push({
        date: r.date_start,
        campaign: r.campaign_name ?? "Meta кампания",
        spend: Number(r.spend || 0),
        impressions: Number(r.impressions || 0),
        clicks: Number(r.inline_link_clicks || 0),
        reach: Number(r.reach || 0),
        leads: pickLeads(r.actions),
      });
    }
    url = json.paging?.next ?? "";
  }
  return rows;
}

/** Эвристика цели кампании по названию: вакансии vs курс.
 * `va+c` ловит и «vac», и растянутые «vaaaac»/«vaaac» (так владелец называет вакансии). */
export function guessObjective(campaign: string): "course" | "vacancy" {
  return /вакан|va+c|vacancy|hr|job|рекрут|hiring|резюме|сотрудн/i.test(campaign)
    ? "vacancy"
    : "course";
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

export type AdLevel = "campaign" | "adset" | "ad";

interface EntityInsightRow {
  spend?: string;
  impressions?: string;
  clicks?: string;
  reach?: string;
  actions?: { action_type: string; value: string }[];
  [key: string]: unknown;
}

function mapStatus(effective?: string): string {
  if (effective === "ACTIVE") return "active";
  if (effective === "PAUSED" || effective === "CAMPAIGN_PAUSED" || effective === "ADSET_PAUSED")
    return "paused";
  return "archived";
}

/** Сущности кабинета (кампании / группы объявлений / объявления) за период. */
export async function fetchMetaEntities(
  adAccountId: string,
  token: string,
  level: AdLevel,
  since: string,
  until: string,
): Promise<MetaCampaign[]> {
  const id = accountNumber(adAccountId);
  const timeRange = encodeURIComponent(JSON.stringify({ since, until }));
  const idField = `${level}_id`;
  const nameField = `${level}_name`;

  // Статусы (insights их не отдаёт) — отдельный edge
  const statusById = new Map<string, string>();
  try {
    const sres = await fetch(
      `${GRAPH}/act_${id}/${level}s?fields=id,effective_status&limit=500&access_token=${encodeURIComponent(token)}`,
      { next: { revalidate: 120 } },
    );
    const sjson = (await sres.json()) as { data?: { id: string; effective_status?: string }[] };
    for (const c of sjson.data ?? []) statusById.set(c.id, mapStatus(c.effective_status));
  } catch {
    // статус не критичен
  }

  let url =
    `${GRAPH}/act_${id}/insights` +
    `?level=${level}&fields=${idField},${nameField},spend,impressions,inline_link_clicks,reach,actions` +
    `&time_range=${timeRange}&limit=200&access_token=${encodeURIComponent(token)}`;

  const out: MetaCampaign[] = [];
  for (let page = 0; page < 50 && url; page++) {
    const res = await fetch(url, { next: { revalidate: 120 } });
    const json = (await res.json()) as {
      data?: EntityInsightRow[];
      paging?: { next?: string };
      error?: { message?: string };
    };
    if (!res.ok || json.error) throw new Error(json.error?.message ?? "Ошибка запроса данных Meta");
    for (const r of json.data ?? []) {
      const extId = String(r[idField] ?? "");
      const leads = pickLeads(r.actions);
      out.push({
        externalId: extId,
        name: String(r[nameField] ?? "—"),
        metaObjective: "",
        status: statusById.get(extId) ?? "active",
        spend: Number(r.spend || 0),
        impressions: Number(r.impressions || 0),
        clicks: Number((r.inline_link_clicks as string) || 0),
        reach: Number(r.reach || 0),
        leads: Math.round(leads),
      });
    }
    url = json.paging?.next ?? "";
  }
  return out;
}

/** Кампании кабинета (обёртка над fetchMetaEntities). */
export function fetchMetaCampaigns(
  adAccountId: string,
  token: string,
  since: string,
  until: string,
): Promise<MetaCampaign[]> {
  return fetchMetaEntities(adAccountId, token, "campaign", since, until);
}

export interface AdCreativeThumb {
  adId: string;
  thumbUrl: string | null; // миниатюра (есть и у видео, и у картинок)
  fullUrl: string | null; // полная картинка (если объявление-картинка)
}

/**
 * Миниатюры креативов по объявлениям кабинета — для превью в аналитике.
 * Превью не критичны: при ошибке возвращаем, что успели собрать.
 */
export async function fetchAdCreatives(
  adAccountId: string,
  token: string,
): Promise<AdCreativeThumb[]> {
  const id = accountNumber(adAccountId);
  let url =
    `${GRAPH}/act_${id}/ads` +
    `?fields=id,creative{thumbnail_url,image_url}` +
    `&limit=200&access_token=${encodeURIComponent(token)}`;

  const out: AdCreativeThumb[] = [];
  for (let page = 0; page < 20 && url; page++) {
    const res = await fetch(url, { next: { revalidate: 300 } });
    const json = (await res.json()) as {
      data?: { id: string; creative?: { thumbnail_url?: string; image_url?: string } }[];
      paging?: { next?: string };
      error?: { message?: string };
    };
    if (!res.ok || json.error) break;
    for (const a of json.data ?? []) {
      out.push({
        adId: a.id,
        thumbUrl: a.creative?.thumbnail_url ?? null,
        fullUrl: a.creative?.image_url ?? a.creative?.thumbnail_url ?? null,
      });
    }
    url = json.paging?.next ?? "";
  }
  return out;
}

/* ───────────────────────── Lead Ads (формы) ───────────────────────── */

export interface MetaPage {
  id: string;
  name: string;
}

/** Facebook-страницы, доступные токену (для подписки на лид-формы). */
export async function fetchPages(token: string): Promise<MetaPage[]> {
  const res = await fetch(
    `${GRAPH}/me/accounts?fields=id,name&limit=200&access_token=${encodeURIComponent(token)}`,
    { cache: "no-store" },
  );
  const json = (await res.json()) as GraphError & { data?: { id: string; name?: string }[] };
  if (!res.ok || json.error) throw new Error(json.error?.message ?? "Не удалось получить страницы");
  return (json.data ?? []).map((p) => ({ id: p.id, name: p.name ?? p.id }));
}

export interface MetaLead {
  fullName: string;
  phone: string | null;
  email: string | null;
  adId: string | null;
  adsetId: string | null;
  campaignId: string | null;
  formId: string | null;
}

/** Детали заявки с формы по leadgen_id (нужен токен с правом leads_retrieval). */
export async function fetchLead(leadgenId: string, token: string): Promise<MetaLead> {
  const res = await fetch(
    `${GRAPH}/${leadgenId}?fields=field_data,ad_id,adset_id,campaign_id,form_id&access_token=${encodeURIComponent(token)}`,
    { cache: "no-store" },
  );
  const json = (await res.json()) as GraphError & {
    field_data?: { name: string; values: string[] }[];
    ad_id?: string;
    adset_id?: string;
    campaign_id?: string;
    form_id?: string;
  };
  if (!res.ok || json.error) throw new Error(json.error?.message ?? "Не удалось получить заявку");

  const fields = json.field_data ?? [];
  const pick = (re: RegExp) =>
    fields.find((f) => re.test(f.name))?.values?.[0] ?? null;

  return {
    fullName: pick(/name|имя|аты|фио/i) ?? "Без имени",
    phone: pick(/phone|tel|телефон|номер|нөмер/i),
    email: pick(/email|почта|mail/i),
    adId: json.ad_id ?? null,
    adsetId: json.adset_id ?? null,
    campaignId: json.campaign_id ?? null,
    formId: json.form_id ?? null,
  };
}
