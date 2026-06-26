"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getEffectiveRole } from "@/lib/queries";

const MANAGE_ROLES = ["owner", "director", "accountant"];

export interface PayrollForm {
  base_salary: number;
  days_planned: number;
  days_worked: number;
  kpi_bonus: number;
  bonus: number;
  deduction: number;
  status: string;
  note: string;
}

export interface SaveResult {
  ok: boolean;
  error?: string;
}

/** Сохранить (создать/обновить) зарплатную ведомость сотрудника за месяц. */
export async function savePayroll(
  projectId: string,
  userId: string,
  period: string,
  form: PayrollForm,
): Promise<SaveResult> {
  const role = await getEffectiveRole(projectId);
  if (!role || !MANAGE_ROLES.includes(role)) {
    return { ok: false, error: "Недостаточно прав" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const status = ["draft", "approved", "paid"].includes(form.status) ? form.status : "draft";

  const { error } = await supabase.from("payroll").upsert(
    {
      project_id: projectId,
      user_id: userId,
      period,
      base_salary: Math.max(0, Math.round(form.base_salary)),
      days_planned: Math.max(0, Math.round(form.days_planned)),
      days_worked: Math.max(0, Math.round(form.days_worked)),
      kpi_bonus: Math.max(0, Math.round(form.kpi_bonus)),
      bonus: Math.max(0, Math.round(form.bonus)),
      deduction: Math.max(0, Math.round(form.deduction)),
      status,
      note: form.note.trim() || null,
      updated_by: user?.id ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "project_id,user_id,period" },
  );

  if (error) return { ok: false, error: "Не удалось сохранить ведомость" };

  revalidatePath(`/p/${projectId}/salaries`);
  return { ok: true };
}
