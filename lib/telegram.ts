/**
 * Тонкая обёртка над Telegram Bot API + отправка уведомления о новом лиде.
 * Токен живёт только на сервере (env TELEGRAM_BOT_TOKEN).
 */

const API = (method: string) =>
  `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/${method}`;

export interface InlineButton {
  text: string;
  callback_data?: string;
  url?: string;
}

export async function tgCall(method: string, body: Record<string, unknown>) {
  try {
    const res = await fetch(API(method), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return await res.json();
  } catch {
    return { ok: false };
  }
}

export function sendMessage(
  chatId: number | string,
  text: string,
  opts: { buttons?: InlineButton[][]; replyMarkup?: unknown } = {},
) {
  const reply_markup =
    opts.replyMarkup ?? (opts.buttons ? { inline_keyboard: opts.buttons } : undefined);
  return tgCall("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    reply_markup,
  });
}

export function answerCallback(id: string, text?: string, alert = false) {
  return tgCall("answerCallbackQuery", {
    callback_query_id: id,
    text,
    show_alert: alert,
  });
}

/** Перерисовать уже отправленное сообщение (текст + кнопки). */
export function editMessageText(
  chatId: number | string,
  messageId: number,
  text: string,
  buttons?: InlineButton[][],
) {
  return tgCall("editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: "HTML",
    reply_markup: buttons ? { inline_keyboard: buttons } : undefined,
  });
}

/**
 * Клавиатура смены. «Начать смену» — это кнопка запроса геолокации:
 * одно нажатие сразу отправляет локацию, а сервер сам решает, в офисе ли человек.
 */
export function shiftKeyboard() {
  return {
    keyboard: [
      [{ text: "🟢 Начать смену", request_location: true }],
      [{ text: "💵 Моя зарплата" }, { text: "📊 Моя статистика" }],
      [{ text: "🔚 Ушёл" }],
    ],
    resize_keyboard: true,
  };
}

/** Клавиатура менеджера: оформить продажу. */
export function saleKeyboard() {
  return {
    keyboard: [
      [{ text: "💰 Оформить продажу" }],
      [{ text: "💵 Моя зарплата" }, { text: "📊 Моя статистика" }],
    ],
    resize_keyboard: true,
  };
}

/** Клавиатура внутри диалога продажи: отмена. */
export function cancelKeyboard() {
  return {
    keyboard: [[{ text: "❌ Отмена" }]],
    resize_keyboard: true,
  };
}

/** Меню отчётов: прислать сейчас за период + подписка чата на автоотчёт. */
export function reportMenuButtons(): InlineButton[][] {
  return [
    [
      { text: "📅 За день", callback_data: "rep:day" },
      { text: "🗓 За неделю", callback_data: "rep:week" },
      { text: "📆 За месяц", callback_data: "rep:month" },
    ],
    [{ text: "🔔 Автоотчёт в этот чат", callback_data: "repsub" }],
  ];
}

/** Подписка чата: тип отчёта × частота. */
export function reportSubscribeButtons(): InlineButton[][] {
  return [
    [
      { text: "Продажи · день", callback_data: "repset:sales:daily" },
      { text: "Продажи · неделя", callback_data: "repset:sales:weekly" },
    ],
    [
      { text: "Маркетинг · день", callback_data: "repset:marketing:daily" },
      { text: "Маркетинг · неделя", callback_data: "repset:marketing:weekly" },
    ],
    [
      { text: "Полный · день", callback_data: "repset:full:daily" },
      { text: "Полный · неделя", callback_data: "repset:full:weekly" },
      { text: "Полный · месяц", callback_data: "repset:full:monthly" },
    ],
    [{ text: "❌ Выключить автоотчёт", callback_data: "repset:off:off" }],
  ];
}

export function leadCard(lead: {
  full_name: string;
  phone: string | null;
  source: string | null;
}): string {
  return [
    "🔔 <b>Новый лид</b>",
    `👤 ${lead.full_name}`,
    lead.phone ? `📞 ${lead.phone}` : "📞 —",
    lead.source ? `🔗 Источник: ${lead.source}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/** Кнопки нового лида: только «Принять лид». */
export function leadButtons(leadId: string): InlineButton[][] {
  return [[{ text: "✅ Принять лид", callback_data: `accept:${leadId}` }]];
}

/** Кнопки после принятия: «Позвонить». */
export function acceptedButtons(leadId: string): InlineButton[][] {
  return [[{ text: "📞 Позвонить", callback_data: `call:${leadId}` }]];
}

/** Карточка лида в работе (после «Принять»). */
export function leadCardAccepted(lead: {
  full_name: string;
  phone: string | null;
  source: string | null;
}): string {
  return [
    "🟢 <b>Лид в работе</b>",
    `👤 ${lead.full_name}`,
    lead.phone ? `📞 ${lead.phone}` : "📞 —",
    lead.source ? `🔗 Источник: ${lead.source}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}
