import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEffectiveRole } from "@/lib/queries";
import { decryptSecret } from "@/lib/crypto";
import { transcribeAudio } from "@/lib/asr";

const ANALYZE_ROLES = ["owner", "director", "head_sales", "manager"];

/**
 * Распознавание загруженной аудиозаписи → текст.
 * Тело — лёгкий JSON { projectId, path }: файл уже лежит в Storage (загружен
 * клиентом по подписанной ссылке, минуя лимит тела Vercel). Сервер скачивает
 * файл через admin-клиент, зовёт Whisper и удаляет временную запись.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { projectId?: string; path?: string } | null;
  const projectId = String(body?.projectId ?? "");
  const path = String(body?.path ?? "");
  if (!projectId || !path) return NextResponse.json({ error: "Неверный запрос" }, { status: 400 });

  // Авторизация и доступ
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Нет авторизации" }, { status: 401 });
  const role = await getEffectiveRole(projectId);
  if (!role || !ANALYZE_ROLES.includes(role)) {
    return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
  }
  // Путь должен принадлежать проекту
  if (!path.startsWith(`${projectId}/`)) {
    return NextResponse.json({ error: "Неверный путь" }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data: cfg } = await admin
    .from("call_ai_config")
    .select("asr_key_enc, asr_model")
    .eq("project_id", projectId)
    .maybeSingle();
  if (!cfg?.asr_key_enc) {
    return NextResponse.json({ error: "Распознавание речи не подключено" }, { status: 400 });
  }

  let key: string;
  try {
    key = decryptSecret(cfg.asr_key_enc);
  } catch {
    return NextResponse.json({ error: "Не удалось расшифровать ключ" }, { status: 500 });
  }

  const { data: blob, error: dlError } = await admin.storage.from("call-audio").download(path);
  if (dlError || !blob) {
    return NextResponse.json({ error: "Файл не найден в хранилище" }, { status: 400 });
  }

  const filename = path.split("/").pop() ?? "audio.m4a";
  try {
    const text = await transcribeAudio(key, cfg.asr_model, blob, filename);
    return NextResponse.json({ text });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Ошибка распознавания" },
      { status: 502 },
    );
  } finally {
    // Временный файл больше не нужен
    await admin.storage.from("call-audio").remove([path]).catch(() => {});
  }
}
