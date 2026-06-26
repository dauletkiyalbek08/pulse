/**
 * Централизованное форматирование сумм, чисел, процентов и дат.
 * Валюта по умолчанию — тенге (₸); на будущее настраивается на уровне проекта.
 */

export const DEFAULT_CURRENCY = "₸";

const ruNumber = new Intl.NumberFormat("ru-RU");

/** Денежная сумма: «1 234 567 ₸» (целые тенге, неразрывный пробел перед знаком). */
export function formatCurrency(value: number, currency = DEFAULT_CURRENCY): string {
  return `${ruNumber.format(Math.round(value))} ${currency}`;
}

/** Компактная сумма для карточек: «1,2 млн ₸», «150 тыс ₸». */
export function formatCurrencyShort(value: number, currency = DEFAULT_CURRENCY): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1).replace(".", ",")} млн ${currency}`;
  }
  if (abs >= 10_000) {
    return `${Math.round(value / 1_000)} тыс ${currency}`;
  }
  return formatCurrency(value, currency);
}

export function formatNumber(value: number): string {
  return ruNumber.format(value);
}

export function formatPercent(value: number, digits = 1): string {
  return `${value.toFixed(digits).replace(".", ",")}%`;
}

export function formatDate(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}

export function formatDateTime(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}
