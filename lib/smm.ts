/**
 * SMM Studio — генерация идей контента (DeepSeek) + справочники форматов/рубрик/целей.
 * Только сервер: ключ DeepSeek передаётся расшифрованным.
 */

const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";

export const SMM_FORMATS = ["Instagram post", "Stories", "Reels", "TikTok", "YouTube Shorts"];
export const SMM_RUBRICS = [
  "Польза",
  "Кейс ученика",
  "Прогрев",
  "Развлекательное",
  "Оффер",
  "За кадром",
  "Отзыв",
  "Опрос в Stories",
];
export const SMM_GOALS = ["Вовлечение", "Продажа", "Доверие", "Узнаваемость", "Трафик"];

export interface SmmIdea {
  title: string;
  rubric: string;
  goal: string;
  hook: string;
}

const pickOne = (v: unknown, list: string[], fallback: string) =>
  list.includes(String(v)) ? String(v) : fallback;

export async function generateIdeas(
  apiKey: string,
  model: string,
  format: string,
  theme: string,
): Promise<SmmIdea[]> {
  const system =
    "Ты — SMM-стратег онлайн-школы. Придумывай вовлекающие, конкретные идеи контента для соцсетей. " +
    "Пиши на русском. Отвечай строго валидным JSON по заданной схеме.";
  const user =
    `Придумай 6 идей контента для формата «${format}»${theme ? `, тема: ${theme}` : ""}.\n` +
    `Для каждой идеи поля: title (короткое название поста, 3–7 слов), ` +
    `rubric (строго одна из: ${SMM_RUBRICS.join("; ")}), ` +
    `goal (строго одна из: ${SMM_GOALS.join("; ")}), ` +
    `hook (цепляющая первая фраза).\n` +
    `Верни JSON строго по схеме: {"ideas":[{"title":"","rubric":"","goal":"","hook":""}]}`;

  const res = await fetch(DEEPSEEK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: model || "deepseek-chat",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
      temperature: 0.9,
      max_tokens: 1400,
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

  let parsed: { ideas?: unknown };
  try {
    parsed = JSON.parse(json.choices?.[0]?.message?.content ?? "{}");
  } catch {
    throw new Error("Не удалось разобрать ответ ИИ");
  }
  const arr = Array.isArray(parsed.ideas) ? (parsed.ideas as Record<string, unknown>[]) : [];
  return arr
    .map((x) => ({
      title: String(x.title ?? "").slice(0, 200),
      rubric: pickOne(x.rubric, SMM_RUBRICS, "Польза"),
      goal: pickOne(x.goal, SMM_GOALS, "Вовлечение"),
      hook: String(x.hook ?? ""),
    }))
    .filter((x) => x.title);
}
