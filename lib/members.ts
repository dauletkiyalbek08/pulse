import type { Niche } from "@/lib/niches";

/** Роли внутри проекта и их подписи. */
export const ROLE_LABEL: Record<string, string> = {
  director: "Директор",
  manager: "Менеджер",
  hunter: "Хантер",
  teacher: "Учитель",
};

export function roleLabel(role: string): string {
  return ROLE_LABEL[role] ?? role;
}

/** Какие роли можно создавать в проекте этой ниши (ТЗ, разделы 4-5). */
export function rolesForNiche(niche: Niche): string[] {
  return niche === "ecommerce"
    ? ["director", "manager"]
    : ["director", "manager", "hunter", "teacher"];
}
