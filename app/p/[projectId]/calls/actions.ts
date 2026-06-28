"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import type { Json } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEffectiveRole } from "@/lib/queries";
import { encryptSecret } from "@/lib/crypto";
import {
  verifyKey,
  analyzeTranscript,
  DEFAULT_RULES,
  type CallRole,
  type CallResult,
} from "@/lib/call-analysis";
import { verifyAsrKey } from "@/lib/asr";
import { resolveCallAi, getCallAiAvailability } from "@/lib/platform-config";

const MANAGE_ROLES = ["owner", "director", "head_sales"];
const ANALYZE_ROLES = ["owner", "director", "head_sales", "manager"];

async function roleOf(projectId: string): Promise<string | null> {
  return getEffectiveRole(projectId);
}

export interface CallAiStatus {
  connected: boolean; // DeepSeek доступен (платформенный или проектный ключ)
  model: string;
  usingPlatformKey: boolean; // источник DeepSeek — платформа
  hasProjectKey: boolean; // у проекта есть свой ключ DeepSeek
  salesRules: string;
  hunterRules: string;
  asrConnected: boolean; // распознавание речи доступно
  asrModel: string;
  usingPlatformAsr: boolean;
  hasProjectAsr: boolean;
  lastError: string | null;
}

export async function getCallAiStatus(projectId: string): Promise<CallAiStatus> {
  const a = await getCallAiAvailability(projectId);
  const admin = createAdminClient();
  const { data } = await admin
    .from("call_ai_config")
    .select("last_error")
    .eq("project_id", projectId)
    .maybeSingle();
  return {
    connected: a.deepseekReady,
    model: a.deepseekModel,
    usingPlatformKey: a.usingPlatformKey,
    hasProjectKey: a.hasProjectKey,
    salesRules: a.salesRules,
    hunterRules: a.hunterRules,
    asrConnected: a.asrReady,
    asrModel: a.asrModel,
    usingPlatformAsr: a.usingPlatformAsr,
    hasProjectAsr: a.hasProjectAsr,
    lastError: data?.last_error ?? null,
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
  // Ключ распознавания: проектный override → платформенный
  const resolved = await resolveCallAi(projectId);
  if (!resolved.asrKey) return { ok: false, error: "Распознавание речи не подключено" };

  const admin = createAdminClient();
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
  // upsert: проект может работать на платформенных ключах и хранить только правила
  await admin
    .from("call_ai_config")
    .upsert(
      { project_id: projectId, sales_rules: salesRules.trim(), hunter_rules: hunterRules.trim() },
      { onConflict: "project_id" },
    );
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
  opts?: { audioSeconds?: number | null; source?: "text" | "audio" },
): Promise<AnalyzeResult> {
  if (!ANALYZE_ROLES.includes((await roleOf(projectId)) ?? "")) return { ok: false, error: "Недостаточно прав" };
  if (!employeeId) return { ok: false, error: "Выберите сотрудника" };
  const text = transcript.trim();
  if (text.length < 30) return { ok: false, error: "Слишком короткий текст разговора" };

  const admin = createAdminClient();
  // Ключ DeepSeek + правила: проектный override → платформенный
  const resolved = await resolveCallAi(projectId);
  if (!resolved.deepseekKey) {
    return {
      ok: false,
      error: "ИИ-анализ не настроен. Владелец платформы должен добавить ключ DeepSeek в «Настройках платформы».",
    };
  }

  // Роль сотрудника в проекте → тип разговора
  const { data: member } = await admin
    .from("project_members")
    .select("role")
    .eq("project_id", projectId)
    .eq("user_id", employeeId)
    .maybeSingle();
  const role: CallRole = member?.role === "hunter" ? "hunter" : "sales";
  const rules = role === "hunter" ? resolved.hunterRules : resolved.salesRules;

  let result: CallResult;
  try {
    result = await analyzeTranscript(resolved.deepseekKey, resolved.deepseekModel, role, rules, text);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Ошибка анализа";
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
      source: opts?.source ?? "text",
      audio_seconds: opts?.audioSeconds ?? null,
      created_by: user?.id ?? null,
    })
    .select("id")
    .maybeSingle();

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
