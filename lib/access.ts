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
const FINANCE = ["finance", "salaries", "contracts"];
const BASE = ["", "attendance"];

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
  teacher: [...BASE, "trials", "schedules"],
  marketer: [...BASE, "leads", ...MARKETING, "reports"],
  targetologist: [...BASE, "leads", "ads", "creatives", "marketing", "capi", "reports"],
  smm: [...BASE, "smm", "creatives", "resources", "ai"],
  accountant: [...BASE, ...FINANCE, "reports", "schedules"],
};

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
