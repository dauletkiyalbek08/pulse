import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

/**
 * Шифрование секретов интеграций (токены рекламных кабинетов) — AES-256-GCM.
 * Ключ берётся из env INTEGRATION_ENC_KEY (32 байта в hex). Только сервер;
 * расшифрованный токен никогда не покидает серверную логику.
 *
 * Формат шифротекста: "<iv_b64>:<tag_b64>:<data_b64>".
 */

function key(): Buffer {
  const raw = process.env.INTEGRATION_ENC_KEY;
  if (!raw) throw new Error("INTEGRATION_ENC_KEY не задан");
  const k = Buffer.from(raw.trim(), "hex");
  if (k.length !== 32) throw new Error("INTEGRATION_ENC_KEY должен быть 32 байта (64 hex-символа)");
  return k;
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}:${tag.toString("base64")}:${data.toString("base64")}`;
}

export function decryptSecret(payload: string): string {
  const [ivB64, tagB64, dataB64] = payload.split(":");
  if (!ivB64 || !tagB64 || !dataB64) throw new Error("Повреждённый шифротекст");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]).toString("utf8");
}
