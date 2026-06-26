"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getEffectiveRole } from "@/lib/queries";

const MANAGE_ROLES = ["owner", "director", "accountant"];

export interface FinanceEntryForm {
  kind: string;
  category: string;
  title: string;
  amount: number;
  spent_on: string;
  note: string;
}

export interface SaveResult {
  ok: boolean;
  error?: string;
}

export async function addFinanceEntry(
  projectId: string,
  form: FinanceEntryForm,
): Promise<SaveResult> {
  const role = await getEffectiveRole(projectId);
  if (!role || !MANAGE_ROLES.includes(role)) {
    return { ok: false, error: "Недостаточно прав" };
  }

  const title = form.title.trim();
  if (!title) return { ok: false, error: "Введите название операции" };
  if (!Number.isFinite(form.amount) || form.amount <= 0) {
    return { ok: false, error: "Введите сумму" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("finance_entries").insert({
    project_id: projectId,
    kind: form.kind === "income" ? "income" : "expense",
    category: form.category || "other",
    title,
    amount: Math.round(form.amount),
    spent_on: form.spent_on,
    note: form.note.trim() || null,
    created_by: user?.id ?? null,
  });

  if (error) return { ok: false, error: "Не удалось сохранить операцию" };

  revalidatePath(`/p/${projectId}/finance`);
  return { ok: true };
}

/** Курс доллара к тенге для пересчёта рекламы (director/accountant/владелец). */
export async function setUsdRate(projectId: string, rate: number): Promise<SaveResult> {
  const role = await getEffectiveRole(projectId);
  if (!role || !MANAGE_ROLES.includes(role)) {
    return { ok: false, error: "Недостаточно прав" };
  }
  if (!Number.isFinite(rate) || rate < 1) return { ok: false, error: "Неверный курс" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_usd_rate", {
    p_project_id: projectId,
    p_rate: Math.round(rate),
  });
  if (error) return { ok: false, error: "Не удалось сохранить курс" };

  revalidatePath(`/p/${projectId}/finance`);
  return { ok: true };
}

export async function deleteFinanceEntry(
  projectId: string,
  id: string,
): Promise<SaveResult> {
  const role = await getEffectiveRole(projectId);
  if (!role || !MANAGE_ROLES.includes(role)) {
    return { ok: false, error: "Недостаточно прав" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("finance_entries")
    .delete()
    .eq("id", id)
    .eq("project_id", projectId);

  if (error) return { ok: false, error: "Не удалось удалить" };

  revalidatePath(`/p/${projectId}/finance`);
  return { ok: true };
}
