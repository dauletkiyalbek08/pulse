/**
 * Реклама: каналы (Meta/TikTok) и цели таргетинга (курс / вакансии).
 * Расходы из этого раздела автоматически собираются в «Финансы».
 */

export const AD_CHANNELS: { key: string; label: string }[] = [
  { key: "meta", label: "Meta (Instagram/Facebook)" },
  { key: "tiktok", label: "TikTok" },
  { key: "other", label: "Другое" },
];

export const AD_OBJECTIVES: { key: string; label: string }[] = [
  { key: "course", label: "Курс" },
  { key: "vacancy", label: "Вакансии" },
  { key: "other", label: "Другое" },
];

const CHANNEL_LABEL = new Map(AD_CHANNELS.map((c) => [c.key, c.label]));
const CHANNEL_SHORT: Record<string, string> = { meta: "Meta", tiktok: "TikTok", other: "Другое" };
const OBJECTIVE_LABEL = new Map(AD_OBJECTIVES.map((o) => [o.key, o.label]));

export function channelLabel(key: string): string {
  return CHANNEL_LABEL.get(key) ?? "Другое";
}

export function channelShort(key: string): string {
  return CHANNEL_SHORT[key] ?? "Другое";
}

export function objectiveLabel(key: string): string {
  return OBJECTIVE_LABEL.get(key) ?? "Другое";
}

/** Статус кампании → подпись и тон Pill. */
export const CAMPAIGN_STATUS: Record<string, { label: string; tone: "success" | "neutral" | "warning" }> = {
  active: { label: "Активна", tone: "success" },
  paused: { label: "Пауза", tone: "neutral" },
  archived: { label: "Архив", tone: "warning" },
};

export function campaignStatusMeta(status: string) {
  return CAMPAIGN_STATUS[status] ?? CAMPAIGN_STATUS.paused;
}
