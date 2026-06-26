/** Статусы и тарифы проекта + их человекочитаемые подписи. */

export type ProjectStatus = "active" | "paused" | "completed";
export type ProjectPlan = "free" | "trial" | "pro";
export type StatusTone = "active" | "paused" | "done";

export const PROJECT_STATUS_META: Record<
  ProjectStatus,
  { label: string; tone: StatusTone }
> = {
  active: { label: "Активен", tone: "active" },
  paused: { label: "На паузе", tone: "paused" },
  completed: { label: "Завершён", tone: "done" },
};

export const PLAN_META: Record<ProjectPlan, { label: string }> = {
  free: { label: "Free" },
  trial: { label: "Trial" },
  pro: { label: "Pro" },
};

export function getProjectStatusMeta(status: string) {
  return PROJECT_STATUS_META[status as ProjectStatus] ?? PROJECT_STATUS_META.active;
}
