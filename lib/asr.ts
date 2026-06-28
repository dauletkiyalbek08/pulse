/**
 * Распознавание речи (аудио → текст) через OpenAI Whisper.
 * Только сервер: ключ передаётся расшифрованным и наружу не уходит.
 * Whisper определяет язык сам (казахский/русский) — подходит для смешанных звонков.
 */

const OPENAI_TRANSCRIBE = "https://api.openai.com/v1/audio/transcriptions";
const OPENAI_MODELS = "https://api.openai.com/v1/models";

/** Лимит Whisper на размер файла. */
export const ASR_MAX_BYTES = 25 * 1024 * 1024;

/** Проверка ключа OpenAI (лёгкий запрос списка моделей). */
export async function verifyAsrKey(apiKey: string): Promise<void> {
  const res = await fetch(OPENAI_MODELS, {
    headers: { Authorization: `Bearer ${apiKey}` },
    cache: "no-store",
  });
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    throw new Error(j.error?.message ?? `Ключ OpenAI не принят (HTTP ${res.status})`);
  }
}

export interface Transcription {
  text: string;
  /** Длительность аудио в секундах (для учёта расхода). 0 — если неизвестна. */
  durationSec: number;
}

/** Распознать аудиофайл в текст (+ длительность для учёта расхода). */
export async function transcribeAudio(
  apiKey: string,
  model: string,
  file: Blob,
  filename: string,
): Promise<Transcription> {
  const form = new FormData();
  form.append("file", file, filename);
  form.append("model", model || "whisper-1");
  // verbose_json возвращает длительность распознанного аудио
  form.append("response_format", "verbose_json");

  const res = await fetch(OPENAI_TRANSCRIBE, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
    cache: "no-store",
  });
  const json = (await res.json()) as {
    text?: string;
    duration?: number;
    error?: { message?: string };
  };
  if (!res.ok || json.error) {
    throw new Error(json.error?.message ?? `Ошибка распознавания (HTTP ${res.status})`);
  }
  return { text: json.text ?? "", durationSec: Math.round(Number(json.duration) || 0) };
}
