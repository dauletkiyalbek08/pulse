import type { MenuSection } from "@/lib/menu";

/**
 * Матрица доступа: какие разделы (segment пути от /p/[projectId]) видит роль.
 * Используется и для фильтрации меню, и для серверной защиты маршрутов
 * (см. requireAccess в lib/queries.ts). owner и владелец проекта → director.
 *
 * Базово всем сотрудникам доступны Главная ("") и Посещаемость ("attendance"),
 * чтобы каждый мог отметить смену.
 */

const SALES_CRM = ["leads", "funnel", "trials", "sales", "clients", "calls", "team"];
const MARKETING = ["ads", "creatives", "marketing", "smm", "capi", "resources", "ai"];
const FINANCE = ["finance", "contracts"];
// Главная, «Мой отчёт», посещаемость и «своя зарплата» доступны каждому сотруднику.
const BASE = ["", "my", "attendance", "salaries"];

/** "*" = полный доступ. */
const ACCESS: Record<string, string[]> = {
  owner: ["*"],
  director: ["*"],
  head_sales: [...BASE, ...SALES_CRM, "hunter", "reports", "schedules"],
  manager: [
    ...BASE,
    "leads",
    "funnel",
    "trials",
    "sales",
    "clients",
    "calls",
    "team",
    "products", // ecommerce-менеджер
    "tiktok",
  ],
  hunter: [...BASE, "leads", "hunter", "funnel"],
  teacher: [...BASE, "trials"],
  marketer: [...BASE, "leads", ...MARKETING, "reports", "schedules"],
  targetologist: [...BASE, "leads", "ads", "creatives", "marketing", "capi", "reports"],
  smm: [...BASE, "smm", "creatives", "resources", "ai"],
  accountant: [...BASE, ...FINANCE, "reports"],
};

/** Порядок ролей для матриц на странице «Права доступа». */
export const ROLE_ORDER = [
  "director",
  "head_sales",
  "manager",
  "hunter",
  "teacher",
  "marketer",
  "targetologist",
  "smm",
  "accountant",
] as const;

/** Короткое описание роли для карточек. */
export const ROLE_DESC: Record<string, string> = {
  director: "Полный доступ ко всем разделам платформы",
  head_sales: "Лиды, продажи, команда, воронка и отчёты",
  manager: "Свои лиды, продажи, клиенты и пробные",
  hunter: "Свои лиды, Hunter-кабинет и воронка",
  teacher: "Пробные уроки",
  marketer: "Маркетинг, реклама, креативы и графики команды",
  targetologist: "Реклама, креативы, CAPI и качество лидов",
  smm: "SMM Studio, креативы и ресурсы/воронки",
  accountant: "Финансы, зарплаты и договоры",
};

/**
 * Матрица «кто что может» (для наглядности на странице доступа).
 * Часть пунктов уже enforced (доступ к страницам), часть — ориентир на будущее.
 */
export const ACTION_MATRIX: { label: string; roles: string[] }[] = [
  { label: "Видит главный дашборд", roles: [...ROLE_ORDER] },
  { label: "Видит лиды (CRM)", roles: ["director", "head_sales", "manager", "hunter"] },
  { label: "Видит продажи", roles: ["director", "head_sales", "manager", "accountant"] },
  { label: "Видит клиентов", roles: ["director", "head_sales", "manager"] },
  { label: "Видит CRM-воронку", roles: ["director", "head_sales", "manager", "hunter"] },
  { label: "Анализ звонков", roles: ["director", "head_sales", "manager", "hunter"] },
  { label: "Видит рекламу и CAPI", roles: ["director", "marketer", "targetologist"] },
  { label: "Видит финансы (ведомость)", roles: ["director", "accountant"] },
  { label: "Видит свою зарплату", roles: [...ROLE_ORDER] },
  { label: "Управляет зарплатами команды", roles: ["director", "accountant"] },
  { label: "Управляет графиками команды", roles: ["director", "head_sales", "marketer"] },
  { label: "Управляет доступом и сотрудниками", roles: ["director"] },
];

export function canAccess(role: string | null, segment: string): boolean {
  if (!role) return false;
  const allowed = ACCESS[role];
  if (!allowed) return false;
  return allowed.includes("*") || allowed.includes(segment);
}

/** Полный доступ (владелец/директор) — для фильтрации меню без перебора. */
export function hasFullAccess(role: string | null): boolean {
  return !!role && (ACCESS[role]?.includes("*") ?? false);
}

/** Оставляет в меню только доступные роли пункты; пустые секции убирает. */
export function filterMenuByRole(
  sections: MenuSection[],
  role: string | null,
): MenuSection[] {
  if (hasFullAccess(role)) return sections;
  return sections
    .map((s) => ({ ...s, items: s.items.filter((i) => canAccess(role, i.segment)) }))
    .filter((s) => s.items.length > 0);
}
