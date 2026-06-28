/**
 * Платформенные ключи ИИ (анализ звонков) — один набор владельца на ВСЕ проекты.
 * Ключи DeepSeek (анализ текста) и OpenAI/Whisper (распознавание речи) хранятся
 * зашифрованно в platform_config. Проект может задать СВОЙ ключ (override) в
 * call_ai_config — тогда используется он; иначе берётся платформенный.
 *
 * Только сервер: расшифрованные ключи наружу не уходят.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { decryptSecret } from "@/lib/crypto";
import { DEFAULT_RULES } from "@/lib/call-analysis";

/** Примерная стоимость для учёта расхода (в долларах). */
export const WHISPER_USD_PER_MIN = 0.006; // OpenAI Whisper
export const DEEPSEEK_USD_PER_CALL = 0.002; // грубая оценка одного разбора текста

export interface PlatformAiConfig {
  deepseekKeyEnc: string | null;
  deepseekModel: string;
  openaiKeyEnc: string | null;
  asrModel: string;
}

/** Платформенная конфигурация ИИ (единственная строка id=1). */
export async function getPlatformConfig(): Promise<PlatformAiConfig> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("platform_config")
    .select("deepseek_key_enc, deepseek_model, openai_key_enc, asr_model")
    .eq("id", 1)
    .maybeSingle();
  return {
    deepseekKeyEnc: data?.deepseek_key_enc ?? null,
    deepseekModel: data?.deepseek_model || "deepseek-chat",
    openaiKeyEnc: data?.openai_key_enc ?? null,
    asrModel: data?.asr_model || "whisper-1",
  };
}

function safeDecrypt(enc: string | null): string | null {
  if (!enc) return null;
  try {
    return decryptSecret(enc);
  } catch {
    return null;
  }
}

/**
 * Доступность ИИ для проекта БЕЗ расшифровки ключей (для статуса/UI):
 * учитывает и проектный override, и платформенные ключи.
 */
export interface CallAiAvailability {
  deepseekReady: boolean;
  deepseekModel: string;
  usingPlatformKey: boolean; // источник DeepSeek — платформа (нет override проекта)
  asrReady: boolean;
  asrModel: string;
  usingPlatformAsr: boolean;
  salesRules: string;
  hunterRules: string;
  hasProjectKey: boolean; // у проекта есть свой ключ DeepSeek
  hasProjectAsr: boolean; // у проекта есть свой ключ OpenAI
}

export async function getCallAiAvailability(projectId: string): Promise<CallAiAvailability> {
  const admin = createAdminClient();
  const [platform, projRes] = await Promise.all([
    getPlatformConfig(),
    admin
      .from("call_ai_config")
      .select("api_key_enc, model, asr_key_enc, asr_model, sales_rules, hunter_rules")
      .eq("project_id", projectId)
      .maybeSingle(),
  ]);
  const proj = projRes.data;

  const hasProjectKey = !!proj?.api_key_enc;
  const hasProjectAsr = !!proj?.asr_key_enc;

  const deepseekReady = hasProjectKey || !!platform.deepseekKeyEnc;
  const asrReady = hasProjectAsr || !!platform.openaiKeyEnc;

  return {
    deepseekReady,
    deepseekModel: hasProjectKey ? proj?.model || platform.deepseekModel : platform.deepseekModel,
    usingPlatformKey: !hasProjectKey,
    asrReady,
    asrModel: hasProjectAsr ? proj?.asr_model || platform.asrModel : platform.asrModel,
    usingPlatformAsr: !hasProjectAsr,
    salesRules: proj?.sales_rules || DEFAULT_RULES.sales,
    hunterRules: proj?.hunter_rules || DEFAULT_RULES.hunter,
    hasProjectKey,
    hasProjectAsr,
  };
}

/**
 * Разрешённые (расшифрованные) ключи для фактического вызова ИИ.
 * Проектный ключ имеет приоритет над платформенным.
 */
export interface ResolvedCallAi {
  deepseekKey: string | null;
  deepseekModel: string;
  asrKey: string | null;
  asrModel: string;
  salesRules: string;
  hunterRules: string;
}

export async function resolveCallAi(projectId: string): Promise<ResolvedCallAi> {
  const admin = createAdminClient();
  const [platform, projRes] = await Promise.all([
    getPlatformConfig(),
    admin
      .from("call_ai_config")
      .select("api_key_enc, model, asr_key_enc, asr_model, sales_rules, hunter_rules")
      .eq("project_id", projectId)
      .maybeSingle(),
  ]);
  const proj = projRes.data;

  const deepseekKey = proj?.api_key_enc ? safeDecrypt(proj.api_key_enc) : safeDecrypt(platform.deepseekKeyEnc);
  const deepseekModel = proj?.api_key_enc ? proj.model || platform.deepseekModel : platform.deepseekModel;

  const asrKey = proj?.asr_key_enc ? safeDecrypt(proj.asr_key_enc) : safeDecrypt(platform.openaiKeyEnc);
  const asrModel = proj?.asr_key_enc ? proj.asr_model || platform.asrModel : platform.asrModel;

  return {
    deepseekKey,
    deepseekModel,
    asrKey,
    asrModel,
    salesRules: proj?.sales_rules || DEFAULT_RULES.sales,
    hunterRules: proj?.hunter_rules || DEFAULT_RULES.hunter,
  };
}
