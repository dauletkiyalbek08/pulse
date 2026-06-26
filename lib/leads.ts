import type { Niche } from "@/lib/niches";

/**
 * Статусы лидов и источники. Статусы различаются по нише (ТЗ, раздел 6):
 * education: new|qualified|trial|sale; ecommerce: new|processed|sale.
 */
export type PillTone = "neutral" | "info" | "warning" | "violet" | "success";

const EDUCATION_STATUS: Record<string, { label: string; tone: PillTone }> = {
  new: { label: "Новый", tone: "neutral" },
  qualified: { label: "Квалифицирован", tone: "info" },
  trial: { label: "Пробный урок", tone: "violet" },
  sale: { label: "Продажа", tone: "success" },
};

const ECOMMERCE_STATUS: Record<string, { label: string; tone: PillTone }> = {
  new: { label: "Новый", tone: "neutral" },
  processed: { label: "Обработан", tone: "info" },
  sale: { label: "Продажа", tone: "success" },
};

export function getLeadStatusMeta(niche: Niche, status: string) {
  const map = niche === "ecommerce" ? ECOMMERCE_STATUS : EDUCATION_STATUS;
  return map[status] ?? { label: status, tone: "neutral" as PillTone };
}

/** Порядок статусов для сводных чипов сверху страницы. */
export function leadStatusOrder(niche: Niche): string[] {
  return niche === "ecommerce"
    ? ["new", "processed", "sale"]
    : ["new", "qualified", "trial", "sale"];
}

const SOURCE_LABEL: Record<string, string> = {
  meta: "Meta",
  tiktok: "TikTok",
  other: "Другое",
};

export function sourceLabel(source: string | null): string {
  if (!source) return "—";
  return SOURCE_LABEL[source] ?? source;
}
