"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEffectiveRole } from "@/lib/queries";
import { encryptSecret, decryptSecret } from "@/lib/crypto";
import { verifyDataset, sendPurchase } from "@/lib/capi";

const MANAGE_ROLES = ["owner", "director", "marketer", "targetologist"];

async function canManage(projectId: string): Promise<boolean> {
  const role = await getEffectiveRole(projectId);
  return !!role && MANAGE_ROLES.includes(role);
}

export interface CapiStatus {
  connected: boolean;
  datasetId: string;
  testEventCode: string | null;
  status: string;
  lastEventAt: string | null;
  lastError: string | null;
}

export async function getCapiStatus(projectId: string): Promise<CapiStatus | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("capi_config")
    .select("dataset_id, test_event_code, status, last_event_at, last_error")
    .eq("project_id", projectId)
    .maybeSingle();
  if (!data) return null;
  return {
    connected: true,
    datasetId: data.dataset_id,
    testEventCode: data.test_event_code,
    status: data.status,
    lastEventAt: data.last_event_at,
    lastError: data.last_error,
  };
}

export interface CapiEventRow {
  id: string;
  leadId: string | null;
  value: number;
  currency: string;
  status: string;
  eventName: string;
  response: string | null;
  createdAt: string;
}

export async function getCapiEvents(projectId: string): Promise<CapiEventRow[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("capi_events")
    .select("id, lead_id, value, currency, status, event_name, response, created_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(30);
  return (data ?? []).map((e) => ({
    id: e.id,
    leadId: e.lead_id,
    value: Number(e.value),
    currency: e.currency,
    status: e.status,
    eventName: e.event_name,
    response: e.response,
    createdAt: e.created_at,
  }));
}

export interface ConnectCapiResult {
  ok: boolean;
  error?: string;
  name?: string;
}

export async function connectCapi(
  projectId: string,
  datasetId: string,
  token: string,
  testEventCode: string,
): Promise<ConnectCapiResult> {
  if (!(await canManage(projectId))) return { ok: false, error: "Недостаточно прав" };
  if (!datasetId.trim()) return { ok: false, error: "Укажите ID датасета (Pixel)" };
  if (!token.trim()) return { ok: false, error: "Укажите токен доступа" };

  let info;
  try {
    info = await verifyDataset(datasetId.trim(), token.trim());
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Не удалось проверить датасет" };
  }

  let token_enc: string;
  try {
    token_enc = encryptSecret(token.trim());
  } catch {
    return { ok: false, error: "Сервер не настроен (нет ключа шифрования)" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const admin = createAdminClient();
  const { error } = await admin.from("capi_config").upsert(
    {
      project_id: projectId,
      dataset_id: datasetId.trim(),
      token_enc,
      test_event_code: testEventCode.trim() || null,
      status: "connected",
      last_error: null,
      connected_by: user?.id ?? null,
    },
    { onConflict: "project_id" },
  );
  if (error) return { ok: false, error: "Не удалось сохранить подключение" };

  revalidatePath(`/p/${projectId}/capi`);
  return { ok: true, name: info.name };
}

export async function disconnectCapi(projectId: string): Promise<{ ok: boolean }> {
  if (!(await canManage(projectId))) return { ok: false };
  const admin = createAdminClient();
  await admin.from("capi_config").delete().eq("project_id", projectId);
  revalidatePath(`/p/${projectId}/capi`);
  return { ok: true };
}

export interface TestResult {
  ok: boolean;
  error?: string;
  message?: string;
}

/** Отправить тестовое событие Purchase по последнему лиду с рекламы (для проверки связи). */
export async function sendCapiTest(projectId: string): Promise<TestResult> {
  if (!(await canManage(projectId))) return { ok: false, error: "Недостаточно прав" };

  const admin = createAdminClient();
  const { data: cfg } = await admin
    .from("capi_config")
    .select("dataset_id, token_enc, test_event_code")
    .eq("project_id", projectId)
    .maybeSingle();
  if (!cfg) return { ok: false, error: "Сначала подключите датасет" };

  // Нужен лид с рекламы (external_id = leadgen_id) — иначе привязывать не к чему.
  const { data: lead } = await admin
    .from("leads")
    .select("id, external_id")
    .eq("project_id", projectId)
    .not("external_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!lead?.external_id) {
    return {
      ok: false,
      error: "Нет лида с рекламы (с lead_id) для теста. Тест появится после первой реальной заявки с формы Meta.",
    };
  }

  let token: string;
  try {
    token = decryptSecret(cfg.token_enc);
  } catch {
    return { ok: false, error: "Не удалось расшифровать токен" };
  }

  const eventId = `test-${randomUUID()}`;
  const res = await sendPurchase(
    cfg.dataset_id,
    token,
    { leadId: lead.external_id, value: 1, currency: "KZT", eventId },
    cfg.test_event_code,
  );

  await admin.from("capi_events").insert({
    project_id: projectId,
    lead_id: lead.id,
    event_id: eventId,
    event_name: "Purchase",
    value: 1,
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

  revalidatePath(`/p/${projectId}/capi`);
  if (!res.ok) return { ok: false, error: res.error ?? "Ошибка отправки" };
  return {
    ok: true,
    message: cfg.test_event_code
      ? `Отправлено (events_received=${res.received}). Открой Test Events в Meta — событие появится там.`
      : `Отправлено (events_received=${res.received}).`,
  };
}
