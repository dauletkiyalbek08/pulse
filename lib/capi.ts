/**
 * Conversions API (CAPI) для Lead Ads.
 * Шлём событие Purchase в датасет (Pixel), привязанное к `lead_id` (leadgen_id
 * заявки с формы) — Meta сама понимает, с какого креатива пришёл покупатель,
 * и строит по таким людям похожую аудиторию (lookalike).
 *
 * Токен и dataset_id живут только на сервере (capi_config, токен шифрованно).
 */

const GRAPH = "https://graph.facebook.com/v23.0";

interface GraphError {
  error?: { message?: string; code?: number; error_subcode?: number };
}

/** Проверить, что токен имеет доступ к датасету (перед сохранением подключения). */
export async function verifyDataset(
  datasetId: string,
  token: string,
): Promise<{ id: string; name: string }> {
  const res = await fetch(
    `${GRAPH}/${datasetId}?fields=id,name&access_token=${encodeURIComponent(token)}`,
    { cache: "no-store" },
  );
  const json = (await res.json()) as GraphError & { id?: string; name?: string };
  if (!res.ok || json.error || !json.id) {
    throw new Error(json.error?.message ?? "Датасет недоступен (проверьте ID и токен)");
  }
  return { id: json.id, name: json.name ?? json.id };
}

export interface PurchaseEvent {
  /** leadgen_id заявки (leads.external_id) — связывает покупку с креативом. */
  leadId: string;
  value: number;
  currency: string; // ISO, напр. "KZT"
  /** Уникальный id события для дедупликации на стороне Meta. */
  eventId: string;
  /** Unix-время события (сек). По умолчанию — сейчас. */
  eventTime?: number;
}

export interface CapiResult {
  ok: boolean;
  received?: number;
  error?: string;
  raw: unknown;
}

/**
 * Отправить событие Purchase в датасет, привязанное к лиду (CRM-конверсия).
 * action_source = system_generated + user_data.lead_id — формат CAPI for Lead Ads.
 */
export async function sendPurchase(
  datasetId: string,
  token: string,
  e: PurchaseEvent,
  testEventCode?: string | null,
): Promise<CapiResult> {
  const body: Record<string, unknown> = {
    data: [
      {
        event_name: "Purchase",
        event_time: e.eventTime ?? Math.floor(Date.now() / 1000),
        action_source: "system_generated",
        event_id: e.eventId,
        user_data: { lead_id: Number(e.leadId) },
        custom_data: {
          value: e.value,
          currency: e.currency,
          lead_event_source: "Pulse",
          event_source: "crm",
        },
      },
    ],
    access_token: token,
  };
  if (testEventCode) body.test_event_code = testEventCode;

  try {
    const res = await fetch(`${GRAPH}/${datasetId}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const json = (await res.json()) as GraphError & { events_received?: number };
    if (!res.ok || json.error) {
      return { ok: false, error: json.error?.message ?? `HTTP ${res.status}`, raw: json };
    }
    return { ok: true, received: json.events_received, raw: json };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "network error", raw: null };
  }
}
