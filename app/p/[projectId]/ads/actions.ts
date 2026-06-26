"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getEffectiveRole } from "@/lib/queries";

const MANAGE_ROLES = ["owner", "director", "marketer", "targetologist"];

export interface AdSpendForm {
  channel: string;
  objective: string;
  campaign: string;
  amount: number;
  spent_on: string;
  leads: number;
  note: string;
}

export interface SaveResult {
  ok: boolean;
  error?: string;
}

export async function addAdSpend(
  projectId: string,
  form: AdSpendForm,
): Promise<SaveResult> {
  const role = await getEffectiveRole(projectId);
  if (!role || !MANAGE_ROLES.includes(role)) {
    return { ok: false, error: "Недостаточно прав" };
  }

  const campaign = form.campaign.trim();
  if (!campaign) return { ok: false, error: "Введите название кампании" };
  if (!Number.isFinite(form.amount) || form.amount <= 0) {
    return { ok: false, error: "Введите сумму расхода" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("ad_spend").insert({
    project_id: projectId,
    channel: ["meta", "tiktok", "other"].includes(form.channel) ? form.channel : "meta",
    objective: ["course", "vacancy", "other"].includes(form.objective) ? form.objective : "course",
    campaign,
    amount: Math.round(form.amount),
    spent_on: form.spent_on,
    leads: Math.max(0, Math.round(form.leads)),
    note: form.note.trim() || null,
    created_by: user?.id ?? null,
  });

  if (error) return { ok: false, error: "Не удалось сохранить расход" };

  revalidatePath(`/p/${projectId}/ads`);
  revalidatePath(`/p/${projectId}/finance`);
  return { ok: true };
}

export async function deleteAdSpend(
  projectId: string,
  id: string,
): Promise<SaveResult> {
  const role = await getEffectiveRole(projectId);
  if (!role || !MANAGE_ROLES.includes(role)) {
    return { ok: false, error: "Недостаточно прав" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("ad_spend")
    .delete()
    .eq("id", id)
    .eq("project_id", projectId);

  if (error) return { ok: false, error: "Не удалось удалить" };

  revalidatePath(`/p/${projectId}/ads`);
  revalidatePath(`/p/${projectId}/finance`);
  return { ok: true };
}
