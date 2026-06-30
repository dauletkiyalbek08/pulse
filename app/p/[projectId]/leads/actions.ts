"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { pickNextHunter } from "@/lib/distribution";
import { notifyHunter } from "@/lib/lead-dispatch";

export interface NewLeadState {
  error: string | null;
  ok: boolean;
}

export async function createLead(
  projectId: string,
  _prev: NewLeadState,
  formData: FormData,
): Promise<NewLeadState> {
  const fullName = String(formData.get("full_name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const source = String(formData.get("source") ?? "other");
  const valueRaw = String(formData.get("value") ?? "").replace(/[^\d.]/g, "");
  const value = valueRaw ? Number(valueRaw) : 0;

  if (!fullName) return { error: "Введите имя лида", ok: false };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Равная раздача: лид падает хантеру на смене; если никого нет — любому активному
  const assignedTo = await pickNextHunter(supabase, projectId, undefined, { fallbackToAll: true });

  const { data: lead, error } = await supabase
    .from("leads")
    .insert({
      project_id: projectId,
      full_name: fullName,
      phone: phone || null,
      source,
      status: "new",
      value: Number.isFinite(value) ? value : 0,
      assigned_to: assignedTo,
      assigned_at: assignedTo ? new Date().toISOString() : null,
    })
    .select("id")
    .single();

  if (error || !lead) {
    return { error: "Не удалось добавить лид. Попробуйте ещё раз.", ok: false };
  }

  // Уведомление хантеру в Telegram (если привязан)
  if (assignedTo) {
    await notifyHunter(supabase, projectId, assignedTo, {
      id: lead.id,
      full_name: fullName,
      phone: phone || null,
      source,
    });
  }

  revalidatePath(`/p/${projectId}/leads`);
  return { error: null, ok: true };
}
