"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { pickNextHunter } from "@/lib/distribution";
import { sendMessage, leadCard, leadButtons } from "@/lib/telegram";

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

  // Round-robin: лид падает следующему хантеру на смене (или остаётся свободным)
  const assignedTo = await pickNextHunter(supabase, projectId);

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
    })
    .select("id")
    .single();

  if (error || !lead) {
    return { error: "Не удалось добавить лид. Попробуйте ещё раз.", ok: false };
  }

  // Уведомление хантеру в Telegram (если привязан)
  if (assignedTo) {
    const { data: tg } = await supabase
      .from("telegram_links")
      .select("chat_id")
      .eq("project_id", projectId)
      .eq("user_id", assignedTo)
      .maybeSingle();
    if (tg?.chat_id) {
      await sendMessage(tg.chat_id, leadCard({ full_name: fullName, phone: phone || null, source }), {
        buttons: leadButtons(lead.id),
      });
    }
  }

  revalidatePath(`/p/${projectId}/leads`);
  return { error: null, ok: true };
}
