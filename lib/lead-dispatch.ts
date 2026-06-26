import { createClient } from "@/lib/supabase/server";
import { pickNextHunter } from "@/lib/distribution";
import { sendMessage, leadCard, leadButtons } from "@/lib/telegram";

/** Через сколько минут непринятый лид уходит другому хантеру. */
export const REASSIGN_AFTER_MIN = 15;

// Web- и admin-клиент Supabase структурно одинаковы (SupabaseClient<Database>).
type Db = Awaited<ReturnType<typeof createClient>>;

interface LeadInfo {
  id: string;
  full_name: string;
  phone: string | null;
  source: string | null;
}

/** Отправить хантеру карточку лида с кнопкой «Принять» (если привязан Telegram). */
export async function notifyHunter(
  db: Db,
  projectId: string,
  hunterId: string,
  lead: LeadInfo,
) {
  const { data: tg } = await db
    .from("telegram_links")
    .select("chat_id")
    .eq("project_id", projectId)
    .eq("user_id", hunterId)
    .maybeSingle();
  if (tg?.chat_id) {
    await sendMessage(tg.chat_id, leadCard(lead), { buttons: leadButtons(lead.id) });
  }
}

/** Назначить лид хантеру: обновить запись (assigned_at=now, accepted сброшен) и уведомить. */
export async function assignLead(db: Db, projectId: string, leadId: string, hunterId: string) {
  await db
    .from("leads")
    .update({ assigned_to: hunterId, assigned_at: new Date().toISOString(), accepted_at: null })
    .eq("id", leadId);

  const { data: lead } = await db
    .from("leads")
    .select("id, full_name, phone, source")
    .eq("id", leadId)
    .maybeSingle();
  if (lead) await notifyHunter(db, projectId, hunterId, lead);
}

/**
 * Передать лид другому хантеру на смене (исключая текущего). Возвращает true,
 * если нашёлся получатель. Старого хантера уведомляет, что лид передан.
 */
export async function reassignLead(
  db: Db,
  projectId: string,
  leadId: string,
  currentHunterId: string,
): Promise<boolean> {
  const next = await pickNextHunter(db, projectId, currentHunterId);
  if (!next) return false;

  await assignLead(db, projectId, leadId, next);

  const { data: tgOld } = await db
    .from("telegram_links")
    .select("chat_id")
    .eq("project_id", projectId)
    .eq("user_id", currentHunterId)
    .maybeSingle();
  if (tgOld?.chat_id) {
    const { data: lead } = await db
      .from("leads")
      .select("full_name")
      .eq("id", leadId)
      .maybeSingle();
    await sendMessage(
      tgOld.chat_id,
      `⏭ Лид <b>${lead?.full_name ?? ""}</b> передан другому хантеру.`,
    );
  }
  return true;
}
