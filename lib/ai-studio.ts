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
    key: "video_series",
    title: "Видео-креатив",
    description: "Серия связанных роликов с одним персонажем",
    icon: "film",
    temperature: 0.85,
    fields: [
      { name: "topic", label: "Тема / продукт", type: "input" },
      { name: "character", label: "Персонаж", type: "input" },
      { name: "format", label: "Формат", type: "input" },
      { name: "duration", label: "Длительность", type: "input" },
      { name: "count", label: "Количество видео", type: "input" },
      { name: "style", label: "Стиль", type: "input" },
      { name: "cta", label: "CTA", type: "input" },
      { name: "onechar", label: "Один персонаж", type: "input" },
      LANG,
    ],
    prompt: (v) => {
      const one = g(v, "onechar") === "да";
      const count = g(v, "count") || "3";
      return (
        `Ты — режиссёр коротких рекламных роликов для соцсетей. Сделай сценарий СЕРИИ из ${count} связанных видео для ${g(v, "format")}, ` +
        `как единая рекламная кампания. Каждое видео ~${g(v, "duration")}.\n` +
        `Тема/продукт: ${g(v, "topic")}\n` +
        (one
          ? `ОДИН и тот же персонаж во ВСЕХ видео (лицо не должно меняться между роликами). Персонаж: ${g(v, "character") || "придумай и зафиксируй"}.\n`
          : "") +
        `Стиль: ${g(v, "style")}\nПризыв к действию (CTA): ${g(v, "cta")}\n\n` +
        `Выведи строго по разделам:\n` +
        (one ? `1) ЭТАЛОН ПЕРСОНАЖА — детальное описание лица, причёски, одежды и стиля. Повторять ДОСЛОВНО в каждом клипе.\n` : "") +
        `2) Для каждого видео (1..${count}): идея, раскадровка на клипы по 10–15 секунд, и для каждого клипа PROMPT (на английском, для image-to-video модели)` +
        (one ? `, который начинается с того же описания персонажа.\n` : `.\n`) +
        `3) Озвучка/субтитры по каждому видео.\n` +
        `4) В конце каждого видео — CTA: ${g(v, "cta")}.\n` +
        (one
          ? `5) КАК СОБРАТЬ: сгенерируй 1 референс-картинку лица по «эталону» → каждый клип делай image-to-video ОТ НЕЁ → склей клипы по порядку.\n`
          : "") +
        `\nПояснения и озвучку — на языке: ${g(v, "lang")}. PROMPT для видео-модели — на английском.`
      );
    },
  },
  {
    key: "photo_creative",
    title: "Фото-креатив",
    description: "Баннер для таргета: промт для нейросети + текст",
    icon: "image",
    temperature: 0.9,
    fields: [
      { name: "ratio", label: "Формат", type: "input" },
      { name: "type", label: "Тип", type: "input" },
      { name: "offer", label: "Оффер / текст", type: "input" },
      { name: "subject", label: "Объект / персонаж", type: "input" },
      LANG,
    ],
    prompt: (v) =>
      `Ты — креативный директор. Подготовь фото-креатив (рекламный баннер) для таргета.\n` +
      `Формат: ${g(v, "ratio")}\nТип: ${g(v, "type")}\nОффер/текст: ${g(v, "offer")}\nОбъект/персонаж: ${g(v, "subject")}\n\n` +
      `Выведи:\n` +
      `1) PROMPT для нейросети генерации изображения (на английском) — детально: объект, сцена, свет, композиция, стиль, формат ${g(v, "ratio")}.\n` +
      `2) Текст на баннер (заголовок + подзаголовок + CTA) — на языке: ${g(v, "lang")}.\n` +
      `3) 2 альтернативных варианта заголовка.`,
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
