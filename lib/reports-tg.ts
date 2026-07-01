/**
 * Генерация текстовых отчётов для Telegram (личка директора и группы).
 * Отчёты: «продажи» (лиды/пробные/продажи) и «маркетинг» (РНП из Meta).
 * Все даты — в часовом поясе Алматы (UTC+5). Server-only.
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { getDailyAdReport } from "@/lib/ads-daily";

type Admin = ReturnType<typeof createAdminClient>;

export type ReportKind = "sales" | "marketing" | "full";
export type Frequency = "daily" | "weekly" | "monthly";

export interface Period {
  fromYmd: string; // YYYY-MM-DD (включительно)
  toYmd: string; // YYYY-MM-DD (включительно)
  label: string;
}

const OFFSET_MS = 5 * 3600 * 1000; // Алматы UTC+5
const MONTHS = [
  "январь", "февраль", "март", "апрель", "май", "июнь",
  "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь",
];

export function almatyYmd(d: Date = new Date()): string {
  return new Date(d.getTime() + OFFSET_MS).toISOString().slice(0, 10);
}
function ymdAdd(ymd: string, days: number): string {
  const d = new Date(ymd + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
const dm = (ymd: string) => `${ymd.slice(8, 10)}.${ymd.slice(5, 7)}`;
const monthName = (ymd: string) => MONTHS[Number(ymd.slice(5, 7)) - 1];
const isoStart = (ymd: string) => `${ymd}T00:00:00+05:00`;

const kzt = (n: number) => `${Math.round(n).toLocaleString("ru-RU")} ₸`;
const usd = (n: number) => `$${n.toFixed(2)}`;

/** Период для кнопок «прислать сейчас». */
export function onDemandPeriod(kind: "day" | "week" | "month"): Period {
  const today = almatyYmd();
  if (kind === "day") return { fromYmd: today, toYmd: today, label: `за сегодня (${dm(today)})` };
  if (kind === "week") {
    const from = ymdAdd(today, -6);
    return { fromYmd: from, toYmd: today, label: `за неделю (${dm(from)}–${dm(today)})` };
  }
  const from = today.slice(0, 8) + "01";
  return { fromYmd: from, toYmd: today, label: `за ${monthName(today)} (по ${dm(today)})` };
}

/**
 * Период для авто-отправки по расписанию (запуск вечером, 23:00 Алматы —
 * конец дня): daily — за сегодня; weekly — вечером воскресенья за прошедшую
 * неделю; monthly — в последний день месяца за месяц. null — сегодня не нужно.
 */
export function cronPeriod(freq: Frequency, nowYmd: string = almatyYmd()): Period | null {
  const weekday = new Date(nowYmd + "T00:00:00Z").getUTCDay(); // 0=вс,1=пн
  if (freq === "daily") {
    return { fromYmd: nowYmd, toYmd: nowYmd, label: `за сегодня (${dm(nowYmd)})` };
  }
  if (freq === "weekly") {
    if (weekday !== 0) return null; // только вечером воскресенья — итог недели
    const from = ymdAdd(nowYmd, -6);
    return { fromYmd: from, toYmd: nowYmd, label: `за неделю (${dm(from)}–${dm(nowYmd)})` };
  }
  // monthly — только в последний день месяца (завтра уже другой месяц)
  if (ymdAdd(nowYmd, 1).slice(5, 7) === nowYmd.slice(5, 7)) return null;
  const from = nowYmd.slice(0, 8) + "01";
  return { fromYmd: from, toYmd: nowYmd, label: `за ${monthName(nowYmd)}` };
}

async function salesBlock(admin: Admin, projectId: string, p: Period): Promise<string> {
  const fromIso = isoStart(p.fromYmd);
  const toIso = isoStart(ymdAdd(p.toYmd, 1));
  const [{ data: leads }, { data: trials }, { data: sales }] = await Promise.all([
    admin.from("leads").select("status").eq("project_id", projectId).gte("created_at", fromIso).lt("created_at", toIso),
    admin.from("trials").select("status").eq("project_id", projectId).gte("scheduled_at", fromIso).lt("scheduled_at", toIso),
    admin.from("sales").select("amount").eq("project_id", projectId).gte("created_at", fromIso).lt("created_at", toIso),
  ]);
  const L = leads ?? [];
  const T = trials ?? [];
  const S = sales ?? [];
  const qualified = L.filter((l) => ["assigned", "trial", "trial_done", "paid", "sale"].includes(l.status)).length;
  const attended = T.filter((t) => ["attended", "purchased"].includes(t.status)).length;
  const noShow = T.filter((t) => t.status === "no_show").length;
  const purchased = T.filter((t) => t.status === "purchased").length;
  const revenue = S.reduce((a, x) => a + Number(x.amount), 0);
  return [
    "🧾 <b>Отдел продаж</b>",
    `Лиды: <b>${L.length}</b> · обработано: ${qualified}`,
    `Пробные: пришли ${attended}, не пришли ${noShow}, купили ${purchased}`,
    `Продажи: <b>${S.length}</b> на ${kzt(revenue)}`,
  ].join("\n");
}

async function marketingBlock(projectId: string, p: Period): Promise<string> {
  const daily = await getDailyAdReport(projectId, p.fromYmd, p.toYmd);
  const t = daily.totals;
  if (!daily.connected) return "📣 <b>Маркетинг</b>\nMeta-кабинет не подключён.";
  return [
    "📣 <b>Маркетинг · РНП</b>",
    `Расход: <b>${usd(t.spendUsd)}</b> · Лиды: <b>${t.leads}</b> · CPL: ${t.cpl != null ? usd(t.cpl) : "—"}`,
    `Показы: ${t.impressions.toLocaleString("ru-RU")} · Клики: ${t.clicks.toLocaleString("ru-RU")} · CTR: ${t.ctr != null ? t.ctr.toFixed(2) + "%" : "—"}`,
  ].join("\n");
}

/** Собрать текст отчёта для чата. */
export async function buildReport(
  admin: Admin,
  projectId: string,
  kind: ReportKind,
  p: Period,
): Promise<string> {
  const { data: project } = await admin.from("projects").select("name").eq("id", projectId).maybeSingle();
  const parts: string[] = [`📊 <b>${project?.name ?? "Проект"}</b> · ${p.label}`];
  if (kind === "sales" || kind === "full") parts.push(await salesBlock(admin, projectId, p));
  if (kind === "marketing" || kind === "full") parts.push(await marketingBlock(projectId, p));
  return parts.join("\n\n");
}
