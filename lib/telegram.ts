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

/** Клавиатура смены: «Я на смене» (с геолокацией) + «Ушёл». */
export function shiftKeyboard() {
  return {
    keyboard: [
      [{ text: "📍 Я на смене", request_location: true }],
      [{ text: "🔚 Ушёл" }],
    ],
    resize_keyboard: true,
  };
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

export function leadButtons(leadId: string): InlineButton[][] {
  return [
    [
      { text: "✅ Принять лид", callback_data: `accept:${leadId}` },
      { text: "📞 Позвонить", callback_data: `call:${leadId}` },
    ],
  ];
}
