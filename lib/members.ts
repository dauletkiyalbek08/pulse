import type { Niche } from "@/lib/niches";

/** Роли внутри проекта и их подписи. */
export const ROLE_LABEL: Record<string, string> = {
  owner: "Владелец",
  director: "Директор",
  head_sales: "Руководитель продаж",
  manager: "Менеджер",
  hunter: "Хантер",
  teacher: "Учитель",
  marketer: "Маркетолог",
  targetologist: "Таргетолог",
  smm: "SMM-специалист",
  accountant: "Бухгалтер",
};

export function roleLabel(role: string): string {
  return ROLE_LABEL[role] ?? role;
}

/** Все роли, которые можно назначить внутри проекта (единый источник). */
export const PROJECT_ROLES = [
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

/** Какие роли можно создавать в проекте этой ниши (ТЗ, разделы 4-5). */
export function rolesForNiche(niche: Niche): string[] {
  return niche === "ecommerce"
    ? ["director", "manager", "marketer", "accountant"]
    : [
        "director",
        "head_sales",
        "manager",
        "hunter",
        "teacher",
        "marketer",
        "targetologist",
        "smm",
        "accountant",
      ];
}
