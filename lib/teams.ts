/**
 * Командная иерархия: кто кому назначает графики работы.
 * Директор/владелец — вся команда; РОП — продажи; маркетолог — маркетинг.
 */

export const WEEK_DAYS: { iso: number; short: string }[] = [
  { iso: 1, short: "Пн" },
  { iso: 2, short: "Вт" },
  { iso: 3, short: "Ср" },
  { iso: 4, short: "Чт" },
  { iso: 5, short: "Пт" },
  { iso: 6, short: "Сб" },
  { iso: 7, short: "Вс" },
];

/** Роли, которыми может управлять руководитель (для графиков). "all" = вся команда. */
export function manageableRoles(role: string | null): "all" | string[] {
  if (role === "owner" || role === "director") return "all";
  if (role === "head_sales") return ["manager", "hunter", "teacher"];
  if (role === "marketer") return ["smm", "targetologist"];
  return [];
}

export function canManageSchedules(role: string | null): boolean {
  const m = manageableRoles(role);
  return m === "all" || m.length > 0;
}
