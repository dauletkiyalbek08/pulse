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

// Метки атрибуции: Meta подставит id кампании/группы/объявления в URL при клике,
// лендинг сохранит их в лид → продажи связываются с креативом (ROAS по креативу).
export const URL_TAGS = "c={{campaign.id}}&as={{adset.id}}&ad={{ad.id}}";

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

/**
 * Instagram-аккаунт, связанный со Страницей (для identity объявления —
 * показ в Instagram и Threads от этого профиля). null → только Facebook.
 */
export async function fetchPageInstagram(token: string, pageId: string): Promise<string | null> {
  const url =
    `${GRAPH}/${pageId}?fields=instagram_business_account,connected_instagram_account` +
    `&access_token=${encodeURIComponent(token)}`;
  try {
    const res = await fetch(url, { cache: "no-store" });
    const json = (await res.json()) as {
      instagram_business_account?: { id: string };
      connected_instagram_account?: { id: string };
    };
    return json.instagram_business_account?.id ?? json.connected_instagram_account?.id ?? null;
  } catch {
    return null;
  }
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

/** Один креатив запуска: видео или картинка-баннер. */
export interface CreativeInput {
  kind: "video" | "image";
  videoId?: string; // для видео (id в Meta)
  imageUrl?: string; // для картинки (публичный URL)
  thumbUrl?: string | null; // превью видео
}

export interface LaunchParams {
  adAccountId: string;
  token: string;
  pageId: string;
  creatives: CreativeInput[]; // несколько объявлений в одной группе (A/B тест)
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
  instagramUserId: string | null; // identity IG/Threads; null → только Facebook
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
  ads: { creativeId: string; adId: string }[];
}

/**
 * Полный запуск: одна кампания → одна группа → по объявлению на каждый креатив
 * (видео и/или картинки), затем активирует. Meta тестит объявления между собой.
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
  // Площадки: Facebook + Instagram + Threads, только мобильные.
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

  const cta = { type: "LEARN_MORE", value: { link: p.destinationUrl } };

  // 3–4. По объявлению на каждый креатив (видео или картинка) в одной группе.
  const ads: { creativeId: string; adId: string }[] = [];
  let i = 0;
  for (const c of p.creatives) {
    i += 1;
    const objectStorySpec: Record<string, unknown> = { page_id: p.pageId };
    if (c.kind === "video") {
      const videoData: Record<string, unknown> = {
        video_id: c.videoId,
        title: p.headline,
        message: p.primaryText,
        call_to_action: cta,
      };
      if (c.thumbUrl) videoData.image_url = c.thumbUrl;
      objectStorySpec.video_data = videoData;
    } else {
      objectStorySpec.link_data = {
        link: p.destinationUrl,
        message: p.primaryText,
        name: p.headline,
        picture: c.imageUrl,
        call_to_action: cta,
      };
    }
    // Identity: показ в Instagram и Threads от связанного IG-профиля.
    if (p.instagramUserId) objectStorySpec.instagram_user_id = p.instagramUserId;

    const creative = await graphPost<{ id: string }>(`act_${acc}/adcreatives`, p.token, {
      name: `${base} · креатив ${i}`,
      object_story_spec: objectStorySpec,
      // Метки для атрибуции (см. URL_TAGS).
      url_tags: URL_TAGS,
      // Отказ от авто-«расширений браузера» (Позвонить/Messenger/WhatsApp/Форма).
      degrees_of_freedom_spec: {
        creative_features_spec: { site_extensions: { enroll_status: "OPT_OUT" } },
      },
    });

    // Объявление. Отключаем показ в блоке с несколькими рекламодателями.
    const ad = await graphPost<{ id: string }>(`act_${acc}/ads`, p.token, {
      name: `${base} · объявление ${i}`,
      adset_id: adset.id,
      creative: { creative_id: creative.id },
      status: "PAUSED",
      is_multi_advertiser_ads_enabled: false,
    });
    ads.push({ creativeId: creative.id, adId: ad.id });
  }

  // 5. Активация (кампания → группа → все объявления)
  await graphPost(campaign.id, p.token, { status: "ACTIVE" });
  await graphPost(adset.id, p.token, { status: "ACTIVE" });
  for (const a of ads) await graphPost(a.adId, p.token, { status: "ACTIVE" });

  return { campaignId: campaign.id, adsetId: adset.id, ads };
}

/** Изменить дневной бюджет группы объявлений (минорные единицы валюты). */
export async function updateAdSetBudget(token: string, adsetId: string, dailyBudgetMinor: number) {
  await graphPost(adsetId, token, { daily_budget: String(dailyBudgetMinor) });
}

/** Поставить кампанию на паузу. */
export async function pauseCampaign(token: string, campaignId: string) {
  await graphPost(campaignId, token, { status: "PAUSED" });
}

/** Поставить одно объявление (креатив) на паузу. */
export async function pauseAd(token: string, adId: string) {
  await graphPost(adId, token, { status: "PAUSED" });
}

/** Все id объявлений кампании (для бэкфилла меток атрибуции). */
export async function fetchCampaignAdIds(token: string, campaignId: string): Promise<string[]> {
  const url = `${GRAPH}/${campaignId}/ads?fields=id&limit=200&access_token=${encodeURIComponent(token)}`;
  const res = await fetch(url, { cache: "no-store" });
  const json = (await res.json()) as { data?: { id?: string }[]; error?: { message?: string } };
  if (json.error) throw new Error(json.error.message ?? "Ошибка Meta API");
  return (json.data ?? []).map((a) => a.id).filter((v): v is string => !!v);
}

/** Проставить метки атрибуции (url_tags) на объявление — для уже запущенных. */
export async function setAdUrlTags(token: string, adId: string) {
  await graphPost(adId, token, { url_tags: URL_TAGS });
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

  // Медиа запуска: несколько креативов (видео/картинки). Back-compat: одиночное meta_video_id.
  const { data: mediaRows } = await admin
    .from("ad_launch_media")
    .select("id, kind, meta_video_id, image_url, thumb_url, storage_path, position")
    .eq("launch_id", launchId)
    .order("position");

  interface MediaItem {
    id: string | null;
    kind: "video" | "image";
    metaVideoId: string | null;
    imageUrl: string | null;
    thumbUrl: string | null;
  }
  const media: MediaItem[] = (mediaRows ?? []).map((m) => ({
    id: m.id,
    kind: m.kind === "image" ? "image" : "video",
    metaVideoId: m.meta_video_id,
    imageUrl: m.image_url,
    thumbUrl: m.thumb_url,
  }));
  if (media.length === 0 && draft.meta_video_id) {
    media.push({ id: null, kind: "video", metaVideoId: draft.meta_video_id, imageUrl: null, thumbUrl: draft.thumb_url });
  }
  if (media.length === 0) return { ok: false, error: "Нет креативов для запуска" };

  // Готовность всех видео (картинки готовы сразу)
  for (const m of media) {
    if (m.kind === "video" && m.metaVideoId) {
      const st = await videoState(token, m.metaVideoId);
      if (st.failed) return { ok: false, error: "Meta не смогла обработать одно из видео. Замените файл." };
      if (!st.ready) return { ok: false, notReady: true, error: "Видео ещё обрабатывается Meta" };
      if (!m.thumbUrl) m.thumbUrl = st.thumbUrl;
    }
  }

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

  // IG-профиль страницы (для показа в Instagram и Threads). Нет — только Facebook.
  const instagramUserId = await fetchPageInstagram(token, pageId);

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
      creatives: media.map((m) => ({
        kind: m.kind,
        videoId: m.metaVideoId ?? undefined,
        imageUrl: m.imageUrl ?? undefined,
        thumbUrl: m.thumbUrl,
      })),
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
      instagramUserId,
    });

    // Сохраняем id объявлений/креативов по каждому медиа (в том же порядке)
    for (let idx = 0; idx < media.length; idx++) {
      const m = media[idx];
      const a = ids.ads[idx];
      if (m.id && a) {
        await admin
          .from("ad_launch_media")
          .update({ meta_creative_id: a.creativeId, meta_ad_id: a.adId })
          .eq("id", m.id);
      }
    }

    await admin
      .from("ad_launches")
      .update({
        status: "active",
        campaign_id: ids.campaignId,
        adset_id: ids.adsetId,
        ad_id: ids.ads[0]?.adId ?? null,
        error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", launchId);

    // Авто-очистка исходников в хранилище: Meta уже приняла видео и создала
    // креативы (картинки ингестятся при создании). Файлы больше не нужны.
    const paths = (mediaRows ?? [])
      .map((m) => m.storage_path)
      .filter((p): p is string => !!p);
    if (paths.length > 0) {
      try {
        await admin.storage.from("ad-videos").remove(paths);
      } catch {
        // не критично: место освободится позже
      }
    }

    return { ok: true, adId: ids.ads[0]?.adId, campaignId: ids.campaignId };
  } catch (e) {
    const error = e instanceof Error ? e.message : "Ошибка запуска";
    await admin
      .from("ad_launches")
      .update({ status: "failed", error, updated_at: new Date().toISOString() })
      .eq("id", launchId);
    return { ok: false, error };
  }
}
