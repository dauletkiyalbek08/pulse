/**
 * Логика посещаемости: местное время прихода и расчёт опозданий по графику.
 * Часовой пояс проекта пока фиксирован (Алматы); позже вынесем в настройки.
 */
export const ATTENDANCE_TZ = "Asia/Almaty";
export const LATE_GRACE_MIN = 5;

const WD: Record<string, number> = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7,
};

/** Минуты с начала дня (в TZ проекта) для timestamptz. */
export function localMinutesOfDay(iso: string): number {
  const p = new Intl.DateTimeFormat("en-GB", {
    timeZone: ATTENDANCE_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(iso));
  const h = Number(p.find((x) => x.type === "hour")?.value ?? 0);
  const m = Number(p.find((x) => x.type === "minute")?.value ?? 0);
  return h * 60 + m;
}

/** «09:20» в TZ проекта. */
export function localTime(iso: string): string {
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: ATTENDANCE_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

/** «25 июн.» в TZ проекта. */
export function localDate(iso: string): string {
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: ATTENDANCE_TZ,
    day: "2-digit",
    month: "short",
  }).format(new Date(iso));
}

/** YYYY-MM-DD в TZ проекта (для сравнения «сегодня»). */
export function localDay(value: string | Date = new Date()): string {
  const d = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("en-CA", { timeZone: ATTENDANCE_TZ }).format(d);
}

/** ISO-день недели сегодня в TZ проекта (1=Пн .. 7=Вс). */
export function todayIsoWeekday(): number {
  const wd = new Intl.DateTimeFormat("en-US", {
    timeZone: ATTENDANCE_TZ,
    weekday: "short",
  }).format(new Date());
  return WD[wd] ?? 1;
}

/** «09:00:00» → минуты. */
export function scheduleMinutes(t: string | null | undefined): number | null {
  if (!t) return null;
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export type AttendanceStatus = "on_time" | "late";

/** Опоздание относительно графика (с допуском LATE_GRACE_MIN). */
export function lateness(
  startedAtIso: string,
  schedStart: string | null,
): AttendanceStatus {
  const sched = scheduleMinutes(schedStart);
  if (sched == null) return "on_time";
  return localMinutesOfDay(startedAtIso) > sched + LATE_GRACE_MIN ? "late" : "on_time";
}
