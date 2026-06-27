/**
 * Запись продажи по лиду + отправка Purchase в Meta (CAPI).
 * Единая логика для веб-кнопки «Покупка» и бота менеджеров.
 * Работает через серверный admin-клиент (вызовы — только на сервере).
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { decryptSecret } from "@/lib/crypto";
import { sendPurchase } from "@/lib/capi";

type Admin = ReturnType<typeof createAdminClient>;

export type CapiOutcome = "not_configured" | "no_lead_id" | "sent" | "error";

export interface RecordPurchaseInput {
  projectId: string;
  leadId: string;
  managerId: string | null;
  amount: number;
  product?: string | null;
  receiptFileId?: string | null;
}

export interface RecordPurchaseResult {
  ok: boolean;
  error?: string;
  saleId?: string | null;
  capi: CapiOutcome;
  capiMessage?: string;
}

export async function recordPurchase(
  admin: Admin,
  input: RecordPurchaseInput,
): Promise<RecordPurchaseResult> {
  const { projectId, leadId, managerId, amount } = input;
  if (!(amount > 0)) return { ok: false, error: "Сумма должна быть больше нуля", capi: "not_configured" };

  const { data: lead } = await admin
    .from("leads")
    .select("id, external_id, fbc, fbp, phone")
    .eq("id", leadId)
    .eq("project_id", projectId)
    .maybeSingle();
  if (!lead) return { ok: false, error: "Лид не найден", capi: "not_configured" };

  // 1. Запись о продаже (с чеком, если есть)
  const { data: sale } = await admin
    .from("sales")
    .insert({
      project_id: projectId,
      lead_id: leadId,
      manager_id: managerId,
      product: input.product?.trim() || null,
      amount,
      receipt_file_id: input.receiptFileId ?? null,
    })
    .select("id")
    .maybeSingle();

  // 2. Лид → «Продажа», фиксируем сумму
  await admin.from("leads").update({ status: "sale", value: amount }).eq("id", leadId);

  // 3. CAPI — только если подключён датасет И лид с рекламы (есть lead_id)
  const { data: cfg } = await admin
    .from("capi_config")
    .select("dataset_id, token_enc, test_event_code")
    .eq("project_id", projectId)
    .maybeSingle();

  let capi: CapiOutcome = "not_configured";
  let capiMessage: string | undefined;

  // Привязка: Lead Ads (lead_id) или сайт (fbc/fbp). Иначе слать нечего.
  const hasAttribution = !!(lead.external_id || lead.fbc || lead.fbp);

  if (cfg && !hasAttribution) {
    capi = "no_lead_id";
    capiMessage = "У лида нет привязки к рекламе (нет lead_id и fbc/fbp) — событие в CAPI не отправлено.";
  } else if (cfg && hasAttribution) {
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
      const input = lead.external_id
        ? { leadId: lead.external_id, value: amount, currency: "KZT", eventId }
        : { fbc: lead.fbc, fbp: lead.fbp, phone: lead.phone, value: amount, currency: "KZT", eventId };
      const res = await sendPurchase(cfg.dataset_id, token, input, cfg.test_event_code);
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

  return { ok: true, saleId: sale?.id ?? null, capi, capiMessage };
}
