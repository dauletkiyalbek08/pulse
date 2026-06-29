/**
 * AI Studio — генерация маркетинговых текстов через DeepSeek (ключ платформы).
 * Инструменты описаны декларативно: поля формы + сборка промпта.
 */

const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";

export const SYSTEM_PROMPT =
  "Ты — сильный маркетолог и копирайтер рекламного агентства. Пиши понятно, кратко и продающе, " +
  "без воды и клише. По умолчанию отвечай на русском; если в задании указан казахский язык — пиши на казахском. " +
  "Используй простой человеческий язык, ориентируйся на соцсети (Instagram/TikTok).";

export interface ToolField {
  name: string;
  label: string;
  placeholder?: string;
  type: "input" | "textarea" | "select";
  options?: string[];
}

export interface AiTool {
  key: string;
  title: string;
  description: string;
  icon: string;
  fields: ToolField[];
  prompt: (v: Record<string, string>) => string;
  temperature?: number;
}

const LANG: ToolField = { name: "lang", label: "Язык", type: "select", options: ["Русский", "Казахский"] };
const g = (v: Record<string, string>, k: string) => (v[k] ?? "").trim();

export const TOOLS: AiTool[] = [
  {
    key: "video_oneface",
    title: "Видео-сценарий (одно лицо)",
    description: "План ролика 15–60 сек с ОДНИМ лицом: фикс. персонаж + связанные промты для клипов + озвучка",
    icon: "film",
    temperature: 0.8,
    fields: [
      { name: "character", label: "Персонаж (лицо)", type: "textarea", placeholder: "Девушка 25 лет, тёмные волосы, зелёный пиджак, дружелюбная улыбка" },
      { name: "idea", label: "Идея / оффер ролика", type: "textarea", placeholder: "Реклама курса английского: заговори за 2 месяца, первый урок бесплатно" },
      { name: "duration", label: "Длительность", type: "select", options: ["15 сек", "30 сек", "60 сек"] },
      { name: "platform", label: "Площадка", type: "select", options: ["Instagram Reels", "TikTok"] },
      LANG,
    ],
    prompt: (v) =>
      `Ты — режиссёр коротких рекламных роликов для соцсетей. Сделай план видео для ${g(v, "platform")} длительностью ${g(v, "duration")}, ` +
      `где на ВСЁМ ролике один и тот же человек (лицо не должно меняться от клипа к клипу).\n\n` +
      `Персонаж: ${g(v, "character")}\nИдея/оффер: ${g(v, "idea")}\n\n` +
      `Выведи строго по разделам:\n` +
      `1) ЭТАЛОН ПЕРСОНАЖА — одно детальное описание внешности, лица, причёски, одежды и стиля. Его нужно ДОСЛОВНО повторять в каждом клипе, чтобы лицо не менялось.\n` +
      `2) КЛИПЫ — раздели ролик на части по ~10–15 секунд (под ${g(v, "duration")}). Для каждого клипа дай: краткое описание сцены и действие; и PROMPT (на английском, для image-to-video модели), который ОБЯЗАТЕЛЬНО начинается с того же описания персонажа из п.1 (дословно), затем сцена, ракурс, движение камеры.\n` +
      `3) ОЗВУЧКА — текст голоса по клипам.\n` +
      `4) КАК СОБРАТЬ — кратко: сгенерируй ОДНУ референс-картинку лица по «эталону», затем КАЖДЫЙ клип делай image-to-video ОТ ЭТОЙ ЖЕ картинки, потом склей клипы по порядку.\n\n` +
      `Пояснения и озвучку выведи на языке: ${g(v, "lang")}. PROMPT для видео-модели — на английском.`,
  },
  {
    key: "ad",
    title: "Рекламный текст",
    description: "3 варианта объявления для Instagram/Facebook под оффер и аудиторию",
    icon: "megaphone",
    temperature: 0.9,
    fields: [
      { name: "product", label: "Продукт / оффер", type: "textarea", placeholder: "Курс английского за 2 месяца, онлайн, первый урок бесплатно" },
      { name: "audience", label: "Аудитория", type: "input", placeholder: "Взрослые, учат английский для работы" },
      { name: "tone", label: "Тон", type: "select", options: ["Дружелюбный", "Экспертный", "Дерзкий", "Премиум"] },
      LANG,
    ],
    prompt: (v) =>
      `Напиши 3 разных варианта рекламного объявления для Instagram/Facebook.\n` +
      `Продукт/оффер: ${g(v, "product")}\nАудитория: ${g(v, "audience")}\nТон: ${g(v, "tone")}\nЯзык: ${g(v, "lang")}\n` +
      `Каждый вариант: цепляющий заголовок, 2–3 строки текста и призыв к действию. Раздели варианты строкой «———».`,
  },
  {
    key: "reels",
    title: "Идеи Reels / постов",
    description: "Список идей с хуком и кратким сценарием",
    icon: "video",
    temperature: 0.95,
    fields: [
      { name: "topic", label: "Тема / ниша", type: "input", placeholder: "Английский язык, онлайн-школа" },
      { name: "count", label: "Сколько идей", type: "select", options: ["5", "10"] },
      LANG,
    ],
    prompt: (v) =>
      `Дай ${g(v, "count") || "5"} идей для Reels/коротких видео по теме: ${g(v, "topic")}.\n` +
      `Для каждой идеи: сильный хук (первые 3 секунды) и краткий сценарий из 2–3 пунктов. Язык: ${g(v, "lang")}.`,
  },
  {
    key: "quiz",
    title: "Вопросы для квиза",
    description: "Квиз-воронка из 5 вопросов с вариантами ответов",
    icon: "list",
    temperature: 0.8,
    fields: [
      { name: "niche", label: "Ниша / продукт", type: "input", placeholder: "Курс английского языка" },
      LANG,
    ],
    prompt: (v) =>
      `Составь квиз-воронку из 5 вопросов для лидогенерации по продукту: ${g(v, "niche")}.\n` +
      `Для каждого вопроса дай 3–4 варианта ответа. Цель — вовлечь и подвести к оставлению контакта. Язык: ${g(v, "lang")}.`,
  },
  {
    key: "objection",
    title: "Ответы на возражения",
    description: "3 варианта ответа менеджера, снимающего возражение",
    icon: "messages",
    temperature: 0.8,
    fields: [
      { name: "objection", label: "Возражение клиента", type: "input", placeholder: "Дорого / нет времени / подумаю" },
      { name: "product", label: "Продукт / услуга", type: "input", placeholder: "Курс английского" },
      LANG,
    ],
    prompt: (v) =>
      `Клиент возражает: «${g(v, "objection")}». Продукт: ${g(v, "product")}.\n` +
      `Дай 3 варианта вежливого и убедительного ответа менеджера, который снимает возражение и ведёт к следующему шагу. Язык: ${g(v, "lang")}.`,
  },
  {
    key: "offer",
    title: "Заголовки для лендинга",
    description: "5 сильных заголовков-офферов",
    icon: "sparkles",
    temperature: 0.95,
    fields: [
      { name: "product", label: "Продукт", type: "input", placeholder: "Онлайн-курс английского" },
      { name: "benefit", label: "Главная выгода", type: "input", placeholder: "Заговорите за 2 месяца" },
      LANG,
    ],
    prompt: (v) =>
      `Придумай 5 сильных заголовков-офферов для лендинга.\nПродукт: ${g(v, "product")}\nГлавная выгода: ${g(v, "benefit")}\n` +
      `Коротко и цепляюще. Язык: ${g(v, "lang")}.`,
  },
];

export function toolByKey(key: string): AiTool | undefined {
  return TOOLS.find((t) => t.key === key);
}

/** Сгенерировать текст через DeepSeek. Только сервер. */
export async function generateText(
  apiKey: string,
  model: string,
  user: string,
  temperature = 0.8,
): Promise<string> {
  const res = await fetch(DEEPSEEK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: model || "deepseek-chat",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: user },
      ],
      temperature,
      max_tokens: 1600,
    }),
    cache: "no-store",
  });
  const json = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
    error?: { message?: string };
  };
  if (!res.ok || json.error) {
    throw new Error(json.error?.message ?? `Ошибка DeepSeek (HTTP ${res.status})`);
  }
  return (json.choices?.[0]?.message?.content ?? "").trim();
}
