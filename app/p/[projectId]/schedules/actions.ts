"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface ScheduleResult {
  ok: boolean;
  error?: string;
}

/** Сохранить график сотрудника. Авторизация — внутри RPC set_work_schedule. */
export async function saveSchedule(
  projectId: string,
  userId: string,
  days: number[],
  start: string,
  end: string,
): Promise<ScheduleResult> {
  if (days.length === 0) return { ok: false, error: "Выберите хотя бы один день" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_work_schedule", {
    p_project_id: projectId,
    p_user_id: userId,
    p_days: days,
    p_start: start,
    p_end: end,
  });
  if (error) return { ok: false, error: "Нет прав или не удалось сохранить график" };

  revalidatePath(`/p/${projectId}/schedules`);
  return { ok: true };
}
