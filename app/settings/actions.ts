"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { encryptSecret } from "@/lib/crypto";
import { verifyKey } from "@/lib/call-analysis";
import { verifyAsrKey } from "@/lib/asr";
import {
  getPlatformConfig,
  WHISPER_USD_PER_MIN,
  DEEPSEEK_USD_PER_CALL,
} from "@/lib/platform-config";

async function requireOwner(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  const { data } = await supabase
    .from("profiles")
    .select("global_role")
    .eq("id", user.id)
    .maybeSingle();
  return data?.global_role === "owner";
}

async function currentUserId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export interface PlatformAiSettings {
  deepseekConnected: boolean;
  deepseekModel: string;
  openaiConnected: boolean;
  asrModel: string;
}

export async function getPlatformAiSettings(): Promise<PlatformAiSettings> {
  const cfg = await getPlatformConfig();
  return {
    deepseekConnected: !!cfg.deepseekKeyEnc,
    deepseekModel: cfg.deepseekModel,
    openaiConnected: !!cfg.openaiKeyEnc,
    asrModel: cfg.asrModel,
  };
}

export interface SaveResult {
  ok: boolean;
  error?: string;
}

/** Сохранить платформенный ключ DeepSeek (анализ текста) — на все проекты. */
export async function savePlatformDeepseek(apiKey: string, model: string): Promise<SaveResult> {
  if (!(await requireOwner())) return { ok: false, error: "Недостаточно прав" };
  if (!apiKey.trim()) return { ok: false, error: "Укажите ключ DeepSeek" };
  const mdl = model.trim() || "deepseek-chat";

  try {
    await verifyKey(apiKey.trim(), mdl);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Ключ не прошёл проверку" };
  }

  let enc: string;
  try {
    enc = encryptSecret(apiKey.trim());
  } catch {
    return { ok: false, error: "Сервер не настроен (нет ключа шифрования)" };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("platform_config")
    .upsert(
      { id: 1, deepseek_key_enc: enc, deepseek_model: mdl, updated_by: await currentUserId(), updated_at: new Date().toISOString() },
      { onConflict: "id" },
    );
  if (error) return { ok: false, error: "Не удалось сохранить ключ" };

  revalidatePath("/settings");
  return { ok: true };
}

/** Сохранить платформенный ключ OpenAI (Whisper, распознавание речи) — на все проекты. */
export async function savePlatformOpenai(apiKey: string, model: string): Promise<SaveResult> {
  if (!(await requireOwner())) return { ok: false, error: "Недостаточно прав" };
  if (!apiKey.trim()) return { ok: false, error: "Укажите ключ OpenAI" };
  const mdl = model.trim() || "whisper-1";

  try {
    await verifyAsrKey(apiKey.trim());
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Ключ не прошёл проверку" };
  }

  let enc: string;
  try {
    enc = encryptSecret(apiKey.trim());
  } catch {
    return { ok: false, error: "Сервер не настроен (нет ключа шифрования)" };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("platform_config")
    .upsert(
      { id: 1, openai_key_enc: enc, asr_model: mdl, updated_by: await currentUserId(), updated_at: new Date().toISOString() },
      { onConflict: "id" },
    );
  if (error) return { ok: false, error: "Не удалось сохранить ключ" };

  revalidatePath("/settings");
  return { ok: true };
}

export async function disconnectPlatformDeepseek(): Promise<{ ok: boolean }> {
  if (!(await requireOwner())) return { ok: false };
  const admin = createAdminClient();
  await admin.from("platform_config").update({ deepseek_key_enc: null }).eq("id", 1);
  revalidatePath("/settings");
  return { ok: true };
}

export async function disconnectPlatformOpenai(): Promise<{ ok: boolean }> {
  if (!(await requireOwner())) return { ok: false };
  const admin = createAdminClient();
  await admin.from("platform_config").update({ openai_key_enc: null }).eq("id", 1);
  revalidatePath("/settings");
  return { ok: true };
}

export interface ProjectUsage {
  projectId: string;
  name: string;
  calls: number;
  audioMinutes: number;
  estUsd: number;
}

/** Расход ИИ по проектам за текущий месяц (звонки + минуты аудио + примерная стоимость). */
export async function getPlatformUsage(): Promise<ProjectUsage[]> {
  if (!(await requireOwner())) return [];
  const admin = createAdminClient();

  const now = new Date();
  const since = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();

  const { data: rows } = await admin
    .from("call_analyses")
    .select("project_id, audio_seconds")
    .gte("created_at", since);

  const map = new Map<string, { calls: number; seconds: number }>();
  for (const r of rows ?? []) {
    const m = map.get(r.project_id) ?? { calls: 0, seconds: 0 };
    m.calls += 1;
    m.seconds += Number(r.audio_seconds) || 0;
    map.set(r.project_id, m);
  }
  if (map.size === 0) return [];

  const ids = [...map.keys()];
  const { data: projects } = await admin.from("projects").select("id, name").in("id", ids);
  const nameById = new Map((projects ?? []).map((p) => [p.id, p.name]));

  return ids
    .map((id) => {
      const m = map.get(id)!;
      const minutes = m.seconds / 60;
      const estUsd = minutes * WHISPER_USD_PER_MIN + m.calls * DEEPSEEK_USD_PER_CALL;
      return { projectId: id, name: nameById.get(id) ?? "—", calls: m.calls, audioMinutes: minutes, estUsd };
    })
    .sort((a, b) => b.estUsd - a.estUsd);
}
