/**
 * Глобальный выбор диапазона дат (MODULES.md §1).
 * Пресеты + произвольный диапазон, по умолчанию «Последние 7 дней».
 * Состояние живёт в URL (?range=last7 | ?range=custom&from=&to=),
 * сервер резолвит в конкретные даты и фильтрует metrics_daily / sales.
 */

export type RangePreset =
  | "today"
  | "yesterday"
  | "last7"
  | "last30"
  | "thisMonth"
  | "lastMonth"
  | "lastWeek"
  | "custom";

export interface DateRange {
  from: string; // YYYY-MM-DD (включительно)
  to: string; // YYYY-MM-DD (включительно)
  preset: RangePreset;
  label: string;
}

export const RANGE_PRESETS: { key: Exclude<RangePreset, "custom">; label: string }[] = [
  { key: "today", label: "Сегодня" },
  { key: "yesterday", label: "Вчера" },
  { key: "last7", label: "Последние 7 дней" },
  { key: "last30", label: "Последние 30 дней" },
  { key: "thisMonth", label: "Этот месяц" },
  { key: "lastMonth", label: "Прошлый месяц" },
  { key: "lastWeek", label: "Прошлая неделя" },
];

const DEFAULT_PRESET: RangePreset = "last7";

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setUTCDate(r.getUTCDate() + n);
  return r;
}

function dayShort(d: Date): string {
  return `${String(d.getUTCDate()).padStart(2, "0")}.${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function isPreset(v: string | undefined): v is RangePreset {
  return (
    v === "today" ||
    v === "yesterday" ||
    v === "last7" ||
    v === "last30" ||
    v === "thisMonth" ||
    v === "lastMonth" ||
    v === "lastWeek" ||
    v === "custom"
  );
}

export function resolveDateRange(sp: {
  range?: string;
  from?: string;
  to?: string;
}): DateRange {
  const now = new Date();
  const today = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );

  const preset: RangePreset = isPreset(sp.range) ? sp.range : DEFAULT_PRESET;
  let from = today;
  let to = today;

  switch (preset) {
    case "today":
      from = today;
      to = today;
      break;
    case "yesterday":
      from = addDays(today, -1);
      to = addDays(today, -1);
      break;
    case "last30":
      from = addDays(today, -29);
      to = today;
      break;
    case "thisMonth":
      from = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
      to = today;
      break;
    case "lastMonth": {
      const firstThis = new Date(
        Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1),
      );
      to = addDays(firstThis, -1);
      from = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), 1));
      break;
    }
    case "lastWeek": {
      const dow = (today.getUTCDay() + 6) % 7; // 0 = понедельник
      const monThis = addDays(today, -dow);
      from = addDays(monThis, -7);
      to = addDays(monThis, -1);
      break;
    }
    case "custom": {
      const f = sp.from ? new Date(sp.from) : addDays(today, -6);
      const t = sp.to ? new Date(sp.to) : today;
      from = new Date(Date.UTC(f.getUTCFullYear(), f.getUTCMonth(), f.getUTCDate()));
      to = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate()));
      if (from > to) [from, to] = [to, from];
      break;
    }
    case "last7":
    default:
      from = addDays(today, -6);
      to = today;
      break;
  }

  const label =
    preset === "custom"
      ? `${dayShort(from)} – ${dayShort(to)}`
      : (RANGE_PRESETS.find((p) => p.key === preset)?.label ?? "Последние 7 дней");

  return { from: ymd(from), to: ymd(to), preset, label };
}

/** Кол-во дней в диапазоне (включительно). */
export function rangeDays(range: DateRange): number {
  const from = new Date(range.from);
  const to = new Date(range.to);
  return Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1;
}

/**
 * Резолвит диапазон прямо из объекта searchParams страницы
 * (`{ [key]: string | string[] | undefined }`), убирая копипаст в каждом роуте.
 */
export function rangeFromSearchParams(sp: {
  [key: string]: string | string[] | undefined;
}): DateRange {
  const str = (v: string | string[] | undefined) =>
    typeof v === "string" ? v : undefined;
  return resolveDateRange({
    range: str(sp.range),
    from: str(sp.from),
    to: str(sp.to),
  });
}

/**
 * Первая дата ПОСЛЕ диапазона (YYYY-MM-DD) — для фильтра по timestamptz:
 * `created_at >= range.from and created_at < rangeEndExclusive(range)`.
 */
export function rangeEndExclusive(range: DateRange): string {
  const d = new Date(`${range.to}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
