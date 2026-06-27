"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEffectiveRole } from "@/lib/queries";
import { decryptSecret } from "@/lib/crypto";
import { sendPurchase } from "@/lib/capi";

const SELL_ROLES = ["owner", "director", "head_sales", "manager"];

export interface MarkPurchaseResult {
  ok: boolean;
  error?: string;
  /** Что произошло с CAPI: not_configured | no_lead_id | sent | error */
  capi?: "not_configured" | "no_lead_id" | "sent" | "error";
  capiMessage?: string;
}

/**
 * Отметить покупку по лиду: создаётся запись о продаже, лид переходит в «Продажа»,
 * и (если лид пришёл с рекламы Meta и подключён CAPI) в Meta уходит событие Purchase
 * с привязкой к креативу — для оптимизации и похожих аудиторий.
 */
export async function markPurchase(
  projectId: string,
  leadId: string,
  amount: number,
  product: string,
): Promise<MarkPurchaseResult> {
  const role = await getEffectiveRole(projectId);
  if (!role || !SELL_ROLES.includes(role)) return { ok: false, error: "Недостаточно прав" };
  if (!(amount > 0)) return { ok: false, error: "Укажите сумму покупки" };

  const admin = createAdminClient();
  const { data: lead } = await admin
    .from("leads")
    .select("id, external_id, status")
    .eq("id", leadId)
    .eq("project_id", projectId)
    .maybeSingle();
  if (!lead) return { ok: false, error: "Лид не найден" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 1. Запись о продаже
  const { data: sale } = await admin
    .from("sales")
    .insert({
      project_id: projectId,
      lead_id: leadId,
      manager_id: user?.id ?? null,
      product: product.trim() || null,
      amount,
    })
    .select("id")
    .maybeSingle();

  // 2. Лид → «Продажа», фиксируем сумму
  await admin.from("leads").update({ status: "sale", value: amount }).eq("id", leadId);

  // 3. CAPI: только если подключён датасет И лид пришёл с рекламы (есть lead_id)
  const { data: cfg } = await admin
    .from("capi_config")
    .select("dataset_id, token_enc, test_event_code")
    .eq("project_id", projectId)
    .maybeSingle();

  let capi: MarkPurchaseResult["capi"] = "not_configured";
  let capiMessage: string | undefined;

  if (cfg && !lead.external_id) {
    capi = "no_lead_id";
    capiMessage = "Лид не с рекламы Meta — событие в CAPI не отправлено.";
  } else if (cfg && lead.external_id) {
    const eventId = sale?.id ?? `sale-${leadId}-${Date.now()}`;
    let token: string | null = null;
    try {
      token = decryptSecret(cfg.token_enc);
    } catch {
      token = null;
    }
    if (!token) {
      capi = "error";
      capiMessage = "Не удалось расшифровать токен CAPI.";
    } else {
      const res = await sendPurchase(
        cfg.dataset_id,
        token,
        { leadId: lead.external_id, value: amount, currency: "KZT", eventId },
        cfg.test_event_code,
      );
      capi = res.ok ? "sent" : "error";
      capiMessage = res.ok
        ? `Purchase отправлен в Meta (events_received=${res.received}).`
        : `Ошибка CAPI: ${res.error}`;

      await admin.from("capi_events").insert({
        project_id: projectId,
        lead_id: leadId,
        sale_id: sale?.id ?? null,
        event_id: eventId,
        event_name: "Purchase",
        value: amount,
        currency: "KZT",
        status: res.ok ? "sent" : "error",
        response: JSON.stringify(res.raw).slice(0, 2000),
      });
      await admin
        .from("capi_config")
        .update({
          last_event_at: new Date().toISOString(),
          last_error: res.ok ? null : res.error ?? "ошибка",
          status: res.ok ? "connected" : "error",
        })
        .eq("project_id", projectId);
    }
  }

  revalidatePath(`/p/${projectId}/leads`);
  revalidatePath(`/p/${projectId}/sales`);
  revalidatePath(`/p/${projectId}/capi`);
  return { ok: true, capi, capiMessage };
}
