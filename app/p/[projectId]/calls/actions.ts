"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import type { Json } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEffectiveRole } from "@/lib/queries";
import { encryptSecret, decryptSecret } from "@/lib/crypto";
import {
  verifyKey,
  analyzeTranscript,
  DEFAULT_RULES,
  type CallRole,
  type CallResult,
} from "@/lib/call-analysis";
import { verifyAsrKey } from "@/lib/asr";

const MANAGE_ROLES = ["owner", "director", "head_sales"];
const ANALYZE_ROLES = ["owner", "director", "head_sales", "manager"];

async function roleOf(projectId: string): Promise<string | null> {
  return getEffectiveRole(projectId);
}

export interface CallAiStatus {
  connected: boolean;
  model: string;
  status: string;
  lastError: string | null;
  salesRules: string;
  hunterRules: string;
  asrConnected: boolean;
  asrModel: string;
}

export async function getCallAiStatus(projectId: string): Promise<CallAiStatus | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("call_ai_config")
    .select("model, status, last_error, sales_rules, hunter_rules, asr_key_enc, asr_model")
    .eq("project_id", projectId)
    .maybeSingle();
  if (!data) return null;
  return {
    connected: true,
    model: data.model,
    status: data.status,
    lastError: data.last_error,
    salesRules: data.sales_rules || DEFAULT_RULES.sales,
    hunterRules: data.hunter_rules || DEFAULT_RULES.hunter,
    asrConnected: !!data.asr_key_enc,
    asrModel: data.asr_model,
  };
}

/** Подключить распознавание речи (OpenAI Whisper) — ключ шифрованно. */
export async function connectAsr(
  projectId: string,
  apiKey: string,
  model: string,
): Promise<ConnectResult> {
  if (!MANAGE_ROLES.includes((await roleOf(projectId)) ?? "")) return { ok: false, error: "Недостаточно прав" };
  if (!apiKey.trim()) return { ok: false, error: "Укажите API-ключ OpenAI" };

  const admin = createAdminClient();
  const { data: cfg } = await admin
    .from("call_ai_config")
    .select("project_id")
    .eq("project_id", projectId)
    .maybeSingle();
  if (!cfg) return { ok: false, error: "Сначала подключите DeepSeek" };

  try {
    await verifyAsrKey(apiKey.trim());
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Ключ не прошёл проверку" };
  }

  let asr_key_enc: string;
  try {
    asr_key_enc = encryptSecret(apiKey.trim());
  } catch {
    return { ok: false, error: "Сервер не настроен (нет ключа шифрования)" };
  }

  const { error } = await admin
    .from("call_ai_config")
    .update({ asr_key_enc, asr_model: model.trim() || "whisper-1" })
    .eq("project_id", projectId);
  if (error) return { ok: false, error: "Не удалось сохранить ключ распознавания" };

  revalidatePath(`/p/${projectId}/calls`);
  return { ok: true };
}

export async function disconnectAsr(projectId: string): Promise<{ ok: boolean }> {
  if (!MANAGE_ROLES.includes((await roleOf(projectId)) ?? "")) return { ok: false };
  const admin = createAdminClient();
  await admin.from("call_ai_config").update({ asr_key_enc: null }).eq("project_id", projectId);
  revalidatePath(`/p/${projectId}/calls`);
  return { ok: true };
}

export interface UploadUrlResult {
  ok: boolean;
  error?: string;
  path?: string;
  token?: string;
}

/** Подписанная ссылка для загрузки аудио в хранилище (минуя лимит тела запроса). */
export async function createAudioUpload(projectId: string, ext: string): Promise<UploadUrlResult> {
  if (!ANALYZE_ROLES.includes((await roleOf(projectId)) ?? "")) return { ok: false, error: "Недостаточно прав" };
  const admin = createAdminClient();
  const { data: cfg } = await admin
    .from("call_ai_config")
    .select("asr_key_enc")
    .eq("project_id", projectId)
    .maybeSingle();
  if (!cfg?.asr_key_enc) return { ok: false, error: "Распознавание речи не подключено" };

  const safeExt = (ext || "m4a").replace(/[^a-z0-9]/gi, "").slice(0, 8) || "m4a";
  const path = `${projectId}/${randomUUID()}.${safeExt}`;
  const { data, error } = await admin.storage.from("call-audio").createSignedUploadUrl(path);
  if (error || !data) return { ok: false, error: "Не удалось подготовить загрузку" };
  return { ok: true, path: data.path, token: data.token };
}

export interface ConnectResult {
  ok: boolean;
  error?: string;
}

export async function connectCallAi(
  projectId: string,
  apiKey: string,
  model: string,
): Promise<ConnectResult> {
  if (!MANAGE_ROLES.includes((await roleOf(projectId)) ?? "")) return { ok: false, error: "Недостаточно прав" };
  if (!apiKey.trim()) return { ok: false, error: "Укажите API-ключ DeepSeek" };
  const mdl = model.trim() || "deepseek-chat";

  try {
    await verifyKey(apiKey.trim(), mdl);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Ключ не прошёл проверку" };
  }

  let api_key_enc: string;
  try {
    api_key_enc = encryptSecret(apiKey.trim());
  } catch {
    return { ok: false, error: "Сервер не настроен (нет ключа шифрования)" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const admin = createAdminClient();
  // Сохраняем правила по умолчанию только при первом подключении
  const { data: existing } = await admin
    .from("call_ai_config")
    .select("sales_rules, hunter_rules")
    .eq("project_id", projectId)
    .maybeSingle();

  const { error } = await admin.from("call_ai_config").upsert(
    {
      project_id: projectId,
      provider: "deepseek",
      model: mdl,
      api_key_enc,
      status: "connected",
      last_error: null,
      sales_rules: existing?.sales_rules || DEFAULT_RULES.sales,
      hunter_rules: existing?.hunter_rules || DEFAULT_RULES.hunter,
      connected_by: user?.id ?? null,
    },
    { onConflict: "project_id" },
  );
  if (error) return { ok: false, error: "Не удалось сохранить подключение" };

  revalidatePath(`/p/${projectId}/calls`);
  return { ok: true };
}

export async function updateCallRules(
  projectId: string,
  salesRules: string,
  hunterRules: string,
): Promise<{ ok: boolean }> {
  if (!MANAGE_ROLES.includes((await roleOf(projectId)) ?? "")) return { ok: false };
  const admin = createAdminClient();
  await admin
    .from("call_ai_config")
    .update({ sales_rules: salesRules.trim(), hunter_rules: hunterRules.trim() })
    .eq("project_id", projectId);
  revalidatePath(`/p/${projectId}/calls`);
  return { ok: true };
}

export async function disconnectCallAi(projectId: string): Promise<{ ok: boolean }> {
  if (!MANAGE_ROLES.includes((await roleOf(projectId)) ?? "")) return { ok: false };
  const admin = createAdminClient();
  await admin.from("call_ai_config").delete().eq("project_id", projectId);
  revalidatePath(`/p/${projectId}/calls`);
  return { ok: true };
}

export interface AnalyzeResult {
  ok: boolean;
  error?: string;
  id?: string;
  result?: CallResult;
}

export async function analyzeCall(
  projectId: string,
  employeeId: string,
  transcript: string,
): Promise<AnalyzeResult> {
  if (!ANALYZE_ROLES.includes((await roleOf(projectId)) ?? "")) return { ok: false, error: "Недостаточно прав" };
  if (!employeeId) return { ok: false, error: "Выберите сотрудника" };
  const text = transcript.trim();
  if (text.length < 30) return { ok: false, error: "Слишком короткий текст разговора" };

  const admin = createAdminClient();
  const { data: cfg } = await admin
    .from("call_ai_config")
    .select("model, api_key_enc, sales_rules, hunter_rules")
    .eq("project_id", projectId)
    .maybeSingle();
  if (!cfg) return { ok: false, error: "Сначала подключите DeepSeek" };

  // Роль сотрудника в проекте → тип разговора
  const { data: member } = await admin
    .from("project_members")
    .select("role")
    .eq("project_id", projectId)
    .eq("user_id", employeeId)
    .maybeSingle();
  const role: CallRole = member?.role === "hunter" ? "hunter" : "sales";
  const rules = role === "hunter" ? cfg.hunter_rules : cfg.sales_rules;

  let apiKey: string;
  try {
    apiKey = decryptSecret(cfg.api_key_enc);
  } catch {
    return { ok: false, error: "Не удалось расшифровать ключ" };
  }

  let result: CallResult;
  try {
    result = await analyzeTranscript(apiKey, cfg.model, role, rules, text);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Ошибка анализа";
    await admin.from("call_ai_config").update({ status: "error", last_error: msg }).eq("project_id", projectId);
    return { ok: false, error: msg };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: inserted } = await admin
    .from("call_analyses")
    .insert({
      project_id: projectId,
      employee_id: employeeId,
      role_type: role,
      transcript: text,
      overall_score: result.overall,
      criteria: result.criteria as unknown as Json,
      strengths: result.strengths,
      issues: result.issues,
      recommendations: result.recommendations,
      summary: result.summary,
      created_by: user?.id ?? null,
    })
    .select("id")
    .maybeSingle();

  await admin
    .from("call_ai_config")
    .update({ status: "connected", last_error: null })
    .eq("project_id", projectId);

  revalidatePath(`/p/${projectId}/calls`);
  return { ok: true, id: inserted?.id, result };
}

export async function deleteAnalysis(projectId: string, id: string): Promise<{ ok: boolean }> {
  if (!ANALYZE_ROLES.includes((await roleOf(projectId)) ?? "")) return { ok: false };
  const admin = createAdminClient();
  await admin.from("call_analyses").delete().eq("project_id", projectId).eq("id", id);
  revalidatePath(`/p/${projectId}/calls`);
  return { ok: true };
}
