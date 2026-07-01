/**
 * Создание рекламы в Meta (Graph API) — ТОЛЬКО сервер. Токен приходит уже
 * расшифрованным и наружу не уходит. Поток: загрузить видео → кампания →
 * группа объявлений (аудитория/бюджет) → креатив (видео + текст) → объявление
 * → активация. Для тестового автозапуска из Telegram-бота.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { decryptSecret } from "@/lib/crypto";
import { resolveCallAi } from "@/lib/platform-config";
import { generateText } from "@/lib/ai-studio";

type Admin = ReturnType<typeof createAdminClient>;

const GRAPH = "https://graph.facebook.com/v23.0";

function accountNumber(id: string): string {
  return id.replace(/^act_/, "").trim();
}

interface GraphErr {
  error?: { message?: string; error_user_msg?: string };
}

/** POST на Graph API (form-urlencoded). Бросает понятную ошибку Meta. */
async function graphPost<T = Record<string, unknown>>(
  path: string,
  token: string,
  params: Record<string, unknown>,
): Promise<T> {
  const body = new URLSearchParams();
  body.set("access_token", token);
  for (const [k, v] of Object.entries(params)) {
    body.set(k, typeof v === "string" ? v : JSON.stringify(v));
  }
  const res = await fetch(`${GRAPH}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });
  const json = (await res.json()) as T & GraphErr;
  if (!res.ok || json.error) {
    throw new Error(json.error?.error_user_msg ?? json.error?.message ?? "Ошибка Meta API");
  }
  return json;
}

/* ─────────────────────────── Видео ─────────────────────────── */

/**
 * Загрузка видео в рекламный кабинет по URL (Meta сама скачивает файл).
 * Возвращает id видео; обработка идёт асинхронно (проверяем videoReady).
 */
export async function uploadAdVideo(
  adAccountId: string,
  token: string,
  fileUrl: string,
  name: string,
): Promise<string> {
  const id = accountNumber(adAccountId);
  const res = await graphPost<{ id: string }>(`act_${id}/advideos`, token, {
    file_url: fileUrl,
    name,
  });
  return res.id;
}

export interface VideoState {
  ready: boolean;
  failed: boolean;
  thumbUrl: string | null;
}

/** Статус обработки видео + превью (thumbnail) для креатива. */
export async function videoState(token: string, videoId: string): Promise<VideoState> {
  const sres = await fetch(
    `${GRAPH}/${videoId}?fields=status&access_token=${encodeURIComponent(token)}`,
    { cache: "no-store" },
  );
  const sjson = (await sres.json()) as GraphErr & {
    status?: { video_status?: string };
  };
  const vs = sjson.status?.video_status ?? "processing";

  let thumbUrl: string | null = null;
  try {
    const tres = await fetch(
      `${GRAPH}/${videoId}/thumbnails?fields=uri,is_preferred&access_token=${encodeURIComponent(token)}`,
      { cache: "no-store" },
    );
    const tjson = (await tres.json()) as {
      data?: { uri: string; is_preferred?: boolean }[];
    };
    const thumbs = tjson.data ?? [];
    thumbUrl = (thumbs.find((t) => t.is_preferred) ?? thumbs[0])?.uri ?? null;
  } catch {
    // превью не критично на этапе проверки
  }

  return {
    ready: vs === "ready",
    failed: vs === "error",
    thumbUrl,
  };
}

/* ─────────────── Кампания / группа / креатив / объявление ─────────────── */

const GENDER_CODE: Record<string, number[] | undefined> = {
  all: undefined,
  male: [1],
  female: [2],
};

export interface LaunchParams {
  adAccountId: string;
  token: string;
  pageId: string;
  videoId: string;
  thumbUrl: string | null;
  headline: string;
  primaryText: string;
  destinationUrl: string;
  country: string;
  ageMin: number;
  ageMax: number;
  gender: string; // all|male|female
  dailyBudgetMinor: number; // в минорных единицах валюты кабинета (центы для USD)
  namePrefix: string;
  objective: string; // traffic|leads
  pixelId: string | null; // нужен для оптимизации под заявки (leads)
  advantageAudience: 0 | 1; // Advantage-аудитория: 1 — расширять, 0 — строго
  geoLocations: Record<string, unknown>; // { countries:[...] } или { cities:[...] }
}

/**
 * Поиск ключа города в Meta для таргетинга по городу (напр. «Алматы»).
 * Возвращает geo-key или null (тогда таргетируем по стране).
 */
export async function findCityKey(
  token: string,
  name: string,
  countryCode = "KZ",
): Promise<string | null> {
  const url =
    `${GRAPH}/search?type=adgeolocation&location_types=${encodeURIComponent('["city"]')}` +
    `&country_code=${countryCode}&q=${encodeURIComponent(name)}&limit=10&access_token=${encodeURIComponent(token)}`;
  const res = await fetch(url, { cache: "no-store" });
  const json = (await res.json()) as {
    data?: { key: string; name: string; country_code?: string }[];
  };
  const list = (json.data ?? []).filter((c) => !c.country_code || c.country_code === countryCode);
  return list[0]?.key ?? null;
}

export interface LaunchIds {
  campaignId: string;
  adsetId: string;
  adId: string;
}

/**
 * Полный запуск: создаёт кампанию→группу→креатив→объявление (все на паузе),
 * затем активирует. Возвращает id сущностей.
 * Цель «leads» + пиксель → оптимизация под заявки (OFFSITE_CONVERSIONS / LEAD).
 * Иначе — трафик на сайт с оптимизацией по кликам (надёжная доставка).
 */
export async function launchAdSet(p: LaunchParams): Promise<LaunchIds> {
  const acc = accountNumber(p.adAccountId);
  const stamp = new Date().toISOString().slice(5, 16).replace("T", " ");
  const base = `${p.namePrefix} · ${stamp}`;
  const leadMode = p.objective === "leads" && !!p.pixelId;

  // 1. Кампания (ODAX): лиды или трафик. Бюджет держим на группе (не CBO),
  // поэтому Meta требует явно указать is_adset_budget_sharing_enabled.
  const campaign = await graphPost<{ id: string }>(`act_${acc}/campaigns`, p.token, {
    name: `${base} · кампания`,
    objective: leadMode ? "OUTCOME_LEADS" : "OUTCOME_TRAFFIC",
    status: "PAUSED",
    special_ad_categories: [],
    is_adset_budget_sharing_enabled: false,
  });

  // 2. Группа объявлений: бюджет + аудитория + цель оптимизации.
  // Площадки: только Facebook, Instagram, Threads; только мобильные.
  const targeting: Record<string, unknown> = {
    geo_locations: p.geoLocations,
    age_min: p.ageMin,
    age_max: p.ageMax,
    device_platforms: ["mobile"],
    publisher_platforms: ["facebook", "instagram", "threads"],
    targeting_automation: { advantage_audience: p.advantageAudience },
  };
  const genders = GENDER_CODE[p.gender];
  if (genders) targeting.genders = genders;

  const adsetParams: Record<string, unknown> = {
    name: `${base} · группа`,
    campaign_id: campaign.id,
    daily_budget: String(p.dailyBudgetMinor),
    billing_event: "IMPRESSIONS",
    bid_strategy: "LOWEST_COST_WITHOUT_CAP",
    targeting,
    status: "PAUSED",
  };
  if (leadMode) {
    // Оптимизация под заявки на сайте (событие Lead пикселя)
    adsetParams.optimization_goal = "OFFSITE_CONVERSIONS";
    adsetParams.promoted_object = { pixel_id: p.pixelId, custom_event_type: "LEAD" };
  } else {
    adsetParams.optimization_goal = "LINK_CLICKS";
  }

  const adset = await graphPost<{ id: string }>(`act_${acc}/adsets`, p.token, adsetParams);

  // 3. Креатив: видео + текст + кнопка на квиз
  const videoData: Record<string, unknown> = {
    video_id: p.videoId,
    title: p.headline,
    message: p.primaryText,
    call_to_action: { type: "LEARN_MORE", value: { link: p.destinationUrl } },
  };
  if (p.thumbUrl) videoData.image_url = p.thumbUrl;

  const creative = await graphPost<{ id: string }>(`act_${acc}/adcreatives`, p.token, {
    name: `${base} · креатив`,
    object_story_spec: { page_id: p.pageId, video_data: videoData },
  });

  // 4. Объявление
  const ad = await graphPost<{ id: string }>(`act_${acc}/ads`, p.token, {
    name: `${base} · объявление`,
    adset_id: adset.id,
    creative: { creative_id: creative.id },
    status: "PAUSED",
  });

  // 5. Активация (кампания → группа → объявление)
  await graphPost(campaign.id, p.token, { status: "ACTIVE" });
  await graphPost(adset.id, p.token, { status: "ACTIVE" });
  await graphPost(ad.id, p.token, { status: "ACTIVE" });

  return { campaignId: campaign.id, adsetId: adset.id, adId: ad.id };
}

/* ─────────────────────────── Текст от AI ─────────────────────────── */

export interface AdCopy {
  headline: string;
  primaryText: string;
}

/**
 * Текст объявления через DeepSeek по офферу. Возвращает заголовок + основной
 * текст. Если ИИ недоступен — аккуратный дефолт из оффера.
 */
export async function generateAdCopy(projectId: string, offer: string): Promise<AdCopy> {
  const fallback: AdCopy = {
    headline: "Ағылшын тілі курсы",
    primaryText:
      (offer.trim() || "Ағылшын тілін нөлден сөйлеуге дейін үйреніңіз.") +
      "\n\nОрын саны шектеулі. Тіркелу үшін өтінім қалдырыңыз 👇",
  };

  const ai = await resolveCallAi(projectId);
  if (!ai.deepseekKey) return fallback;

  const prompt =
    "Напиши текст для рекламного объявления в Instagram/Facebook для ОНЛАЙН-КУРСА английского языка. " +
    "Цель — чтобы человек оставил заявку (записался на курс). Реклама ведёт на короткую анкету-квиз. " +
    "ВАЖНО: это НЕ тест на определение уровня английского — это реклама самого курса. НЕ пиши про " +
    "«определи свой уровень» или «диагностика уровня». Пиши про пользу курса и призыв записаться. " +
    "Целевая аудитория — казахстанцы, пиши на КАЗАХСКОМ языке.\n" +
    `Оффер/детали от заказчика (используй как основу): «${offer.trim() || "курс английского языка"}».\n\n` +
    "Формат ответа СТРОГО такой (без пояснений):\n" +
    "HEADLINE: <короткий заголовок до 35 символов>\n" +
    "TEXT: <основной текст 2-4 коротких предложения с эмодзи и призывом оставить заявку / записаться>";

  try {
    const raw = await generateText(ai.deepseekKey, ai.deepseekModel, prompt, 0.8);
    const hMatch = raw.match(/HEADLINE:\s*(.+)/i);
    const tMatch = raw.match(/TEXT:\s*([\s\S]+)/i);
    const headline = (hMatch?.[1] ?? "").trim().slice(0, 40);
    const primaryText = (tMatch?.[1] ?? "").trim();
    if (!headline || !primaryText) return fallback;
    return { headline, primaryText };
  } catch {
    return fallback;
  }
}

/* ─────────────────────────── Высокоуровневый запуск ─────────────────────────── */

export interface LaunchResult {
  ok: boolean;
  error?: string;
  notReady?: boolean; // видео ещё обрабатывается — можно повторить
  adId?: string;
  campaignId?: string;
}

/**
 * Запуск по черновику ad_launches: проверяет готовность видео, берёт конфиг
 * аудитории/бюджета проекта и создаёт рекламу. Идемпотентность обеспечивает
 * вызывающий (статус draft→launching).
 */
export async function launchFromDraft(admin: Admin, launchId: string): Promise<LaunchResult> {
  const { data: draft } = await admin
    .from("ad_launches")
    .select("id, project_id, purpose, meta_video_id, thumb_url, primary_text, headline, budget_usd, advantage, geo_city")
    .eq("id", launchId)
    .maybeSingle();
  if (!draft) return { ok: false, error: "Черновик не найден" };
  if (!draft.meta_video_id) return { ok: false, error: "Видео не загружено" };

  const { data: integ } = await admin
    .from("meta_integration")
    .select("ad_account_id, token_enc, currency")
    .eq("project_id", draft.project_id)
    .eq("purpose", draft.purpose)
    .maybeSingle();
  if (!integ) return { ok: false, error: "Кабинет Meta не подключён" };
  if (integ.currency !== "USD") {
    return {
      ok: false,
      error: `Валюта кабинета ${integ.currency}, а бюджет задан в $. Пока автозапуск работает только с кабинетом в USD.`,
    };
  }

  let token: string;
  try {
    token = decryptSecret(integ.token_enc);
  } catch {
    return { ok: false, error: "Не удалось расшифровать токен кабинета" };
  }

  // Готовность видео
  const state = await videoState(token, draft.meta_video_id);
  if (state.failed) return { ok: false, error: "Meta не смогла обработать видео. Пришлите другой файл." };
  if (!state.ready) return { ok: false, notReady: true, error: "Видео ещё обрабатывается Meta" };

  // Конфиг аудитории/бюджета/страницы/цели
  const { data: cfg } = await admin
    .from("ad_launch_config")
    .select("country, age_min, age_max, gender, daily_budget_usd, destination_url, page_id, objective")
    .eq("project_id", draft.project_id)
    .maybeSingle();

  // Квиз проекта: адрес назначения + пиксель (для оптимизации под заявки)
  const { data: landing } = await admin
    .from("landings")
    .select("slug, pixel_id")
    .eq("project_id", draft.project_id)
    .eq("type", "quiz")
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  // Страница: из конфига или первая привязанная
  let pageId = cfg?.page_id ?? null;
  if (!pageId) {
    const { data: page } = await admin
      .from("meta_pages")
      .select("page_id")
      .eq("project_id", draft.project_id)
      .limit(1)
      .maybeSingle();
    pageId = page?.page_id ?? null;
  }
  if (!pageId) {
    return {
      ok: false,
      error: "Нет привязанной Facebook-страницы. В разделе «Реклама» нажмите «Загрузить страницы».",
    };
  }

  // Куда ведём: из конфига или квиз проекта
  const destinationUrl =
    cfg?.destination_url ??
    (landing?.slug
      ? `https://pulse-drab-chi.vercel.app/l/${landing.slug}`
      : "https://pulse-drab-chi.vercel.app/l/quiz");

  const budgetUsd = Number(cfg?.daily_budget_usd ?? draft.budget_usd ?? 5);
  const dailyBudgetMinor = Math.max(100, Math.round(budgetUsd * 100)); // минимум $1
  const country = cfg?.country ?? "KZ";

  // Гео: конкретный город (если выбран и нашёлся ключ) или вся страна
  let geoLocations: Record<string, unknown> = { countries: [country] };
  if (draft.geo_city) {
    try {
      const key = await findCityKey(token, draft.geo_city, country);
      if (key) geoLocations = { cities: [{ key, radius: 25, distance_unit: "mile" }] };
    } catch {
      // не нашли город — оставляем всю страну
    }
  }

  try {
    const ids = await launchAdSet({
      adAccountId: integ.ad_account_id,
      token,
      pageId,
      videoId: draft.meta_video_id,
      thumbUrl: draft.thumb_url ?? state.thumbUrl,
      headline: draft.headline ?? "Ағылшын тілі курсы",
      primaryText: draft.primary_text ?? "Ағылшын тілін нөлден үйреніңіз.",
      destinationUrl,
      country,
      ageMin: cfg?.age_min ?? 24,
      ageMax: cfg?.age_max ?? 55,
      gender: cfg?.gender ?? "all",
      dailyBudgetMinor,
      namePrefix: "Pulse авто",
      objective: cfg?.objective ?? "leads",
      pixelId: landing?.pixel_id ?? null,
      advantageAudience: draft.advantage ? 1 : 0,
      geoLocations,
    });

    await admin
      .from("ad_launches")
      .update({
        status: "active",
        campaign_id: ids.campaignId,
        adset_id: ids.adsetId,
        ad_id: ids.adId,
        error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", launchId);

    return { ok: true, adId: ids.adId, campaignId: ids.campaignId };
  } catch (e) {
    const error = e instanceof Error ? e.message : "Ошибка запуска";
    await admin
      .from("ad_launches")
      .update({ status: "failed", error, updated_at: new Date().toISOString() })
      .eq("id", launchId);
    return { ok: false, error };
  }
}
