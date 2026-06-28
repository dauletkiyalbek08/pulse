/**
 * ИИ-анализ звонков через DeepSeek (OpenAI-совместимый API).
 * Только сервер: ключ передаётся уже расшифрованным и наружу не уходит.
 * Разговор может быть на казахском или русском — анализ на языке оригинала,
 * ответ всегда на русском.
 */

const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";

export type CallRole = "sales" | "hunter";

/** Критерии оценки по роли (фиксированный набор для структурного балла). */
export const CRITERIA: Record<CallRole, string[]> = {
  sales: [
    "Приветствие и представление",
    "Вежливость и тон",
    "Выявление потребности",
    "Презентация курса",
    "Работа с возражениями",
    "Закрытие / следующий шаг",
  ],
  hunter: [
    "Приветствие и представление",
    "Вежливость и тон",
    "Квалификация лида",
    "Презентация пробного урока",
    "Договорённость о пробном",
    "Следующий шаг",
  ],
};

/** Правила отдела по умолчанию (владелец может изменить в настройках раздела). */
export const DEFAULT_RULES: Record<CallRole, string> = {
  sales: `1. Приветствие: поздороваться, представиться (имя + компания/курс).
2. Вежливость и тон: доброжелательный тон, без перебиваний, обращение по имени.
3. Выявление потребности: задать вопросы о цели, уровне, сроках.
4. Презентация: рассказать о курсе под потребность клиента, показать выгоды.
5. Работа с возражениями: отработать сомнения (цена, время) аргументами.
6. Закрытие: предложить следующий шаг (оплата/запись) и договориться о сроке.`,
  hunter: `1. Приветствие: поздороваться, представиться (имя + компания).
2. Вежливость и тон: доброжелательно, без давления.
3. Квалификация: уточнить интерес, для кого, уровень, контакт.
4. Презентация пробного: объяснить ценность бесплатного пробного урока.
5. Договорённость: предложить конкретные дату и время пробного.
6. Следующий шаг: подтвердить контакт и зафиксировать договорённость.`,
};

export interface CriterionScore {
  name: string;
  score: number; // 0–10
  comment: string;
}

export interface CallResult {
  overall: number; // 0–100
  criteria: CriterionScore[];
  strengths: string[];
  issues: string[];
  recommendations: string[];
  summary: string;
}

interface ChatResp {
  choices?: { message?: { content?: string } }[];
  error?: { message?: string };
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.round(n)));
const toArr = (v: unknown): string[] =>
  Array.isArray(v) ? v.map((x) => String(x)).filter(Boolean) : [];

async function chat(apiKey: string, model: string, body: Record<string, unknown>): Promise<ChatResp> {
  const res = await fetch(DEEPSEEK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, ...body }),
    cache: "no-store",
  });
  const json = (await res.json()) as ChatResp;
  if (!res.ok || json.error) {
    throw new Error(json.error?.message ?? `Ошибка DeepSeek (HTTP ${res.status})`);
  }
  return json;
}

/** Быстрая проверка ключа (минимальный запрос). */
export async function verifyKey(apiKey: string, model: string): Promise<void> {
  await chat(apiKey, model, { messages: [{ role: "user", content: "ping" }], max_tokens: 1 });
}

/** Проанализировать текст разговора по правилам отдела → структурный разбор. */
export async function analyzeTranscript(
  apiKey: string,
  model: string,
  role: CallRole,
  rules: string,
  transcript: string,
): Promise<CallResult> {
  const criteria = CRITERIA[role];
  const who = role === "sales" ? "менеджера отдела продаж" : "хантера (квалификация лидов)";

  const system =
    `Ты — методист и контролёр качества отдела продаж образовательного проекта. ` +
    `Оцениваешь звонок ${who} по правилам отдела. Разговор может быть на казахском или русском — ` +
    `анализируй на языке оригинала, но ВЕСЬ ответ дай на русском. Будь объективным и конкретным, ` +
    `опирайся на реальные реплики, не выдумывай.`;

  const user =
    `Правила отдела:\n${rules || DEFAULT_RULES[role]}\n\n` +
    `Оцени разговор по этим критериям (для каждого — балл 0–10 и короткий конкретный комментарий): ` +
    `${criteria.join("; ")}.\n` +
    `Также дай общий балл 0–100, сильные стороны, ошибки и рекомендации по улучшению.\n\n` +
    `Верни СТРОГО валидный JSON по схеме (без пояснений вне JSON):\n` +
    `{"overall": <0-100>, "criteria": [{"name": "<критерий>", "score": <0-10>, "comment": "<кратко>"}], ` +
    `"strengths": ["..."], "issues": ["..."], "recommendations": ["..."], "summary": "<1-2 предложения>"}\n\n` +
    `Текст разговора:\n"""\n${transcript}\n"""`;

  const json = await chat(apiKey, model, {
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    response_format: { type: "json_object" },
    temperature: 0.2,
    max_tokens: 1800,
  });

  const content = json.choices?.[0]?.message?.content ?? "";
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(content) as Record<string, unknown>;
  } catch {
    throw new Error("Не удалось разобрать ответ ИИ (ожидался JSON)");
  }

  const rawCriteria = Array.isArray(parsed.criteria) ? (parsed.criteria as Record<string, unknown>[]) : [];
  return {
    overall: clamp(Number(parsed.overall) || 0, 0, 100),
    criteria: rawCriteria.map((c) => ({
      name: String(c.name ?? ""),
      score: clamp(Number(c.score) || 0, 0, 10),
      comment: String(c.comment ?? ""),
    })),
    strengths: toArr(parsed.strengths),
    issues: toArr(parsed.issues),
    recommendations: toArr(parsed.recommendations),
    summary: String(parsed.summary ?? ""),
  };
}
