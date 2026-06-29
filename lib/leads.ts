import type { Niche } from "@/lib/niches";

/**
 * Статусы лидов и источники. Пайплайн по нише (AmoCRM-стиль):
 * education: new → assigned → trial → trial_done → paid (+ lost)
 * ecommerce: new → processed → paid (+ lost)
 */
export type PillTone = "neutral" | "info" | "warning" | "violet" | "success" | "danger";

const EDUCATION_STATUS: Record<string, { label: string; tone: PillTone }> = {
  new: { label: "Новый", tone: "neutral" },
  assigned: { label: "Назначен", tone: "info" },
  trial: { label: "Пробный", tone: "violet" },
  trial_done: { label: "Пробный пройден", tone: "warning" },
  paid: { label: "Оплатил", tone: "success" },
  lost: { label: "Потерян", tone: "danger" },
};

const ECOMMERCE_STATUS: Record<string, { label: string; tone: PillTone }> = {
  new: { label: "Новый", tone: "neutral" },
  processed: { label: "Обработан", tone: "info" },
  paid: { label: "Оплатил", tone: "success" },
  lost: { label: "Потерян", tone: "danger" },
};

// «Своя ниша» — универсальный пайплайн без образовательной специфики.
const CUSTOM_STATUS: Record<string, { label: string; tone: PillTone }> = {
  new: { label: "Новый", tone: "neutral" },
  assigned: { label: "В работе", tone: "info" },
  paid: { label: "Оплатил", tone: "success" },
  lost: { label: "Потерян", tone: "danger" },
};

export function getLeadStatusMeta(niche: Niche, status: string) {
  const map =
    niche === "ecommerce" ? ECOMMERCE_STATUS : niche === "custom" ? CUSTOM_STATUS : EDUCATION_STATUS;
  return map[status] ?? { label: status, tone: "neutral" as PillTone };
}

/** Полный порядок статусов воронки (включая «Потерян») — колонки канбана, фильтр. */
export function leadStatusOrder(niche: Niche): string[] {
  if (niche === "ecommerce") return ["new", "processed", "paid", "lost"];
  if (niche === "custom") return ["new", "assigned", "paid", "lost"];
  return ["new", "assigned", "trial", "trial_done", "paid", "lost"];
}

/** Следующий шаг по лиду в статусе (подсказка на карточке канбана). */
export const NEXT_STEP: Record<string, string> = {
  new: "Связаться с клиентом",
  assigned: "Назначить пробный урок",
  trial: "Провести пробный урок",
  trial_done: "Закрыть на оплату",
  processed: "Подтвердить заказ",
  paid: "Сделка закрыта",
  lost: "Лид потерян",
};

const SOURCE_LABEL: Record<string, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  meta: "Meta",
  tiktok: "TikTok",
  other: "Другое",
};

/** Источники для формы добавления лида (MODULES.md §2.1). */
export const LEAD_SOURCES: { value: string; label: string }[] = [
  { value: "instagram", label: "Instagram" },
  { value: "facebook", label: "Facebook" },
  { value: "tiktok", label: "TikTok" },
  { value: "other", label: "Другое" },
];

export function sourceLabel(source: string | null): string {
  if (!source) return "—";
  return SOURCE_LABEL[source] ?? source;
}
