/**
 * Conversions API (CAPI) — отправка событий Purchase в датасет (Pixel).
 *
 * Две схемы привязки покупателя к рекламе:
 *  - Lead Ads (мгновенная форма): user_data.lead_id, action_source=system_generated;
 *  - Сайт (лендинг): user_data.fbc/fbp (+ хэш телефона/почты), action_source=website.
 * Тип выбирается автоматически по тому, что есть у лида.
 *
 * Токен и dataset_id живут только на сервере (capi_config, токен шифрованно).
 */

import { createHash } from "crypto";

const GRAPH = "https://graph.facebook.com/v23.0";

interface GraphError {
  error?: { message?: string; code?: number; error_subcode?: number };
}

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
const hashEmail = (e: string) => sha256(e.trim().toLowerCase());
function hashPhone(p: string): string | null {
  let d = p.replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("8")) d = "7" + d.slice(1); // KZ: 8XXX → 7XXX
  return d ? sha256(d) : null;
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

export interface PurchaseInput {
  value: number;
  currency: string; // ISO, напр. "KZT"
  /** Уникальный id события для дедупликации на стороне Meta. */
  eventId: string;
  eventTime?: number; // unix сек, по умолчанию сейчас
  // Привязка — Lead Ads:
  leadId?: string | null; // leadgen_id
  // Привязка — сайт (Pixel):
  fbc?: string | null;
  fbp?: string | null;
  email?: string | null; // хэшируется перед отправкой
  phone?: string | null; // хэшируется перед отправкой
  sourceUrl?: string | null;
}

export interface CapiResult {
  ok: boolean;
  received?: number;
  error?: string;
  raw: unknown;
}

/** Отправить событие Purchase в датасет (схема выбирается по наличию lead_id / fbc-fbp). */
export async function sendPurchase(
  datasetId: string,
  token: string,
  input: PurchaseInput,
  testEventCode?: string | null,
): Promise<CapiResult> {
  const userData: Record<string, unknown> = {};
  if (input.leadId) userData.lead_id = Number(input.leadId);
  if (input.fbc) userData.fbc = input.fbc;
  if (input.fbp) userData.fbp = input.fbp;
  if (input.email) userData.em = [hashEmail(input.email)];
  if (input.phone) {
    const ph = hashPhone(input.phone);
    if (ph) userData.ph = [ph];
  }

  // Lead Ads → system_generated + CRM-метки; сайт → website.
  const isLeadAds = !!input.leadId;
  const custom_data: Record<string, unknown> = { value: input.value, currency: input.currency };
  if (isLeadAds) {
    custom_data.lead_event_source = "Pulse";
    custom_data.event_source = "crm";
  }

  const event: Record<string, unknown> = {
    event_name: "Purchase",
    event_time: input.eventTime ?? Math.floor(Date.now() / 1000),
    action_source: isLeadAds ? "system_generated" : "website",
    event_id: input.eventId,
    user_data: userData,
    custom_data,
  };
  if (!isLeadAds && input.sourceUrl) event.event_source_url = input.sourceUrl;

  const body: Record<string, unknown> = { data: [event], access_token: token };
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
