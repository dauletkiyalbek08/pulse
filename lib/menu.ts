import type { Niche } from "@/lib/niches";

/**
 * Боковое меню рендерится по нише проекта (ТЗ, разделы 5 и 8).
 * `segment` — относительный путь от /p/[projectId]; пустая строка = Главная.
 * Пункты без реализации ведут на страницу-заглушку (catch-all).
 */
export interface MenuItem {
  label: string;
  segment: string;
  icon: string;
}

export interface MenuSection {
  title: string;
  items: MenuItem[];
}

const EDUCATION_MENU: MenuSection[] = [
  {
    title: "Обзор",
    items: [{ label: "Главная", segment: "", icon: "home" }],
  },
  {
    title: "Продажи и CRM",
    items: [
      { label: "Лиды", segment: "leads", icon: "leads" },
      { label: "CRM-воронка", segment: "funnel", icon: "funnel" },
      { label: "Пробные уроки", segment: "trials", icon: "trials" },
      { label: "Продажи", segment: "sales", icon: "sales" },
      { label: "Клиенты", segment: "clients", icon: "clients" },
      { label: "Анализ звонков", segment: "calls", icon: "calls" },
      { label: "Hunter-кабинет", segment: "hunter", icon: "hunter" },
      { label: "Менеджеры/Учителя", segment: "team", icon: "team" },
    ],
  },
  {
    title: "Маркетинг",
    items: [
      { label: "Реклама", segment: "ads", icon: "ads" },
      { label: "Аналитика креативов", segment: "creatives", icon: "creatives" },
      { label: "Marketing Dashboard", segment: "marketing", icon: "marketing" },
      { label: "SMM Studio", segment: "smm", icon: "smm" },
      { label: "CAPI", segment: "capi", icon: "capi" },
      { label: "Ресурсы/Воронки", segment: "resources", icon: "resources" },
      { label: "AI Studio", segment: "ai", icon: "ai" },
    ],
  },
  {
    title: "Автоматизация",
    items: [
      { label: "ChatBot Builder", segment: "chatbot", icon: "chatbot" },
      { label: "Интеграции", segment: "integrations", icon: "integrations" },
    ],
  },
  {
    title: "Финансы и HR",
    items: [
      { label: "Финансы", segment: "finance", icon: "finance" },
      { label: "Зарплаты", segment: "salaries", icon: "salaries" },
      { label: "Посещаемость", segment: "attendance", icon: "attendance" },
      { label: "Графики работы", segment: "schedules", icon: "schedules" },
      { label: "Договоры", segment: "contracts", icon: "contracts" },
    ],
  },
  {
    title: "Система",
    items: [
      { label: "Отчёты", segment: "reports", icon: "reports" },
      { label: "Настройки", segment: "settings", icon: "settings" },
      { label: "Права доступа", segment: "access", icon: "access" },
    ],
  },
];

const ECOMMERCE_MENU: MenuSection[] = [
  {
    title: "Обзор",
    items: [{ label: "Главная", segment: "", icon: "home" }],
  },
  {
    title: "Продажи и CRM",
    items: [
      { label: "Лиды", segment: "leads", icon: "leads" },
      { label: "Продажи", segment: "sales", icon: "sales" },
      { label: "Менеджеры", segment: "team", icon: "team" },
    ],
  },
  {
    title: "Каталог",
    items: [{ label: "Товары (склад)", segment: "products", icon: "products" }],
  },
  {
    title: "Маркетинг",
    items: [{ label: "TikTok-аналитика", segment: "tiktok", icon: "tiktok" }],
  },
  {
    title: "Система",
    items: [
      { label: "Отчёты", segment: "reports", icon: "reports" },
      { label: "Настройки", segment: "settings", icon: "settings" },
    ],
  },
];

export function getMenu(niche: Niche): MenuSection[] {
  return niche === "ecommerce" ? ECOMMERCE_MENU : EDUCATION_MENU;
}

/** Подпись раздела по сегменту пути (для страницы-заглушки). */
export function labelForSegment(segment: string): string {
  for (const menu of [EDUCATION_MENU, ECOMMERCE_MENU]) {
    for (const section of menu) {
      const item = section.items.find((i) => i.segment === segment);
      if (item) return item.label;
    }
  }
  return "Раздел";
}
