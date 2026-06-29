/**
 * Шаблоны ниш (ТЗ, раздел 3.3 и 5). Ниша определяет иконку, акцент,
 * воронку и — на следующих этапах — состав меню и метрики дашборда.
 */

export type Niche = "education" | "ecommerce" | "custom";

export interface NicheTemplate {
  key: Niche;
  label: string;
  tagline: string;
  /** Этапы воронки слева направо. */
  funnel: string[];
  /** Ключ иконки (см. components/icons). */
  icon: string;
  /** Цвет иконки на карточке по умолчанию. */
  accent: string;
}

export const NICHES: Record<Niche, NicheTemplate> = {
  education: {
    key: "education",
    label: "Образование",
    tagline: "Онлайн-курсы и обучение",
    funnel: ["Лид", "Пробный урок", "Продажа курса"],
    icon: "graduation",
    accent: "#10b981",
  },
  ecommerce: {
    key: "ecommerce",
    label: "Товарка / E-commerce",
    tagline: "Продажа товаров и складской учёт",
    funnel: ["Лид", "Обработан", "Продажа"],
    icon: "shopping",
    accent: "#f97316",
  },
  custom: {
    key: "custom",
    label: "Своя ниша",
    tagline: "Любой бизнес — разделы настраиваются под себя",
    funnel: ["Лид", "В работе", "Продажа"],
    icon: "custom",
    accent: "#6366f1",
  },
};

export const NICHE_LIST: NicheTemplate[] = Object.values(NICHES);

export function isNiche(value: string): value is Niche {
  return value === "education" || value === "ecommerce" || value === "custom";
}

export function getNiche(value: string | null | undefined): NicheTemplate {
  return value && isNiche(value) ? NICHES[value] : NICHES.education;
}

/**
 * Подпись ниши для отображения (сайдбар, топбар): для «своей ниши» — введённое
 * владельцем название (niche_label), иначе подпись шаблона.
 */
export function nicheDisplayLabel(
  niche: string | null | undefined,
  nicheLabel?: string | null,
): string {
  if (niche === "custom" && nicheLabel && nicheLabel.trim()) return nicheLabel.trim();
  return getNiche(niche).label;
}
