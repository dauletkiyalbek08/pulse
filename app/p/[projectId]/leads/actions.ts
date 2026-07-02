"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEffectiveRole } from "@/lib/queries";
import { pickNextHunter } from "@/lib/distribution";
import { notifyHunter, assignLead } from "@/lib/lead-dispatch";

const DISTRIBUTE_ROLES = ["owner", "director", "head_sales"];
// Кто может удалять лиды (например, тестовые): руководство + маркетинг/таргет.
const DELETE_LEAD_ROLES = ["owner", "director", "marketer", "targetologist"];

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

  // Равная раздача: лид падает хантеру НА СМЕНЕ (если никого нет — остаётся «Новый», раздаст РОП)
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

/**
 * РОП/директор раздаёт «зависшие» лиды (без ответственного) хантерам по кругу.
 * Нужно, когда лиды пришли в часы, где никто не был на смене, и остались «Новый».
 * Раздаём поровну между ВСЕМИ активными хантерами (на смене или нет).
 */
export async function distributeUnassignedLeads(
  projectId: string,
): Promise<{ ok: boolean; assigned: number; error?: string }> {
  const role = await getEffectiveRole(projectId);
  if (!DISTRIBUTE_ROLES.includes(role ?? "")) {
    return { ok: false, assigned: 0, error: "Недостаточно прав" };
  }

  const admin = createAdminClient();

  const { data: hunters } = await admin
    .from("project_members")
    .select("user_id")
    .eq("project_id", projectId)
    .eq("role", "hunter")
    .eq("status", "active");
  const hunterIds = (hunters ?? []).map((h) => h.user_id).sort();
  if (hunterIds.length === 0) {
    return { ok: false, assigned: 0, error: "В проекте нет активных хантеров" };
  }

  const { data: leads } = await admin
    .from("leads")
    .select("id")
    .eq("project_id", projectId)
    .is("assigned_to", null)
    .not("status", "in", "(lost,sale,paid)")
    .order("created_at", { ascending: true });
  if (!leads || leads.length === 0) return { ok: true, assigned: 0 };

  let i = 0;
  for (const lead of leads) {
    const hunter = hunterIds[i % hunterIds.length];
    await assignLead(admin, projectId, lead.id, hunter); // обновляет + шлёт в Telegram
    i++;
  }

  revalidatePath(`/p/${projectId}/leads`);
  return { ok: true, assigned: leads.length };
}

/**
 * Удалить лид (и связанные продажи/пробные) — например тестовые заявки.
 * Доступно только руководству и маркетологу/таргетологу.
 */
export async function deleteLead(
  projectId: string,
  leadId: string,
): Promise<{ ok: boolean; error?: string }> {
  const role = await getEffectiveRole(projectId);
  if (!DELETE_LEAD_ROLES.includes(role ?? "")) {
    return { ok: false, error: "Недостаточно прав" };
  }
  const admin = createAdminClient();
  // Дочерние записи с запретом на удаление (NO ACTION) убираем первыми;
  // остальные ссылки (заметки, CAPI, звонки, черновики) каскадятся/обнуляются сами.
  await admin.from("sales").delete().eq("project_id", projectId).eq("lead_id", leadId);
  await admin.from("trials").delete().eq("lead_id", leadId);
  const { error } = await admin.from("leads").delete().eq("project_id", projectId).eq("id", leadId);
  if (error) return { ok: false, error: "Не удалось удалить" };
  revalidatePath(`/p/${projectId}/leads`);
  return { ok: true };
}
