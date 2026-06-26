import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { haversineMeters } from "@/lib/geo";
import {
  sendMessage,
  answerCallback,
  editMessageText,
  shiftKeyboard,
  acceptedButtons,
  leadCardAccepted,
} from "@/lib/telegram";

type Admin = ReturnType<typeof createAdminClient>;

interface TgMessage {
  chat: { id: number };
  text?: string;
  from?: { username?: string };
  location?: { latitude: number; longitude: number };
}
interface TgCallback {
  id: string;
  data?: string;
  message?: { chat?: { id: number }; message_id?: number };
}
interface TgUpdate {
  message?: TgMessage;
  callback_query?: TgCallback;
}

async function findLink(admin: Admin, chatId: number) {
  const { data } = await admin
    .from("telegram_links")
    .select("user_id, project_id")
    .eq("chat_id", chatId)
    .maybeSingle();
  return data;
}

async function startShift(
  admin: Admin,
  projectId: string,
  userId: string,
  lat: number | null,
  lng: number | null,
) {
  const { data: project } = await admin
    .from("projects")
    .select("office_lat, office_lng, office_radius_m")
    .eq("id", projectId)
    .maybeSingle();

  // Гео-проверку делаем только если прислана локация И задан офис
  let distance: number | null = null;
  if (
    lat != null &&
    lng != null &&
    project?.office_lat != null &&
    project?.office_lng != null
  ) {
    distance = haversineMeters(Number(project.office_lat), Number(project.office_lng), lat, lng);
    if (distance > project.office_radius_m) {
      return { ok: false as const, distance, radius: project.office_radius_m };
    }
  }

  const { data: open } = await admin
    .from("shifts")
    .select("id")
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .eq("status", "open")
    .maybeSingle();
  if (open) return { ok: true as const, already: true };

  await admin.from("shifts").insert({
    project_id: projectId,
    user_id: userId,
    start_lat: lat,
    start_lng: lng,
    start_distance_m: distance,
    status: "open",
  });
  return { ok: true as const, distance };
}

async function handleMessage(admin: Admin, msg: TgMessage) {
  const chatId = msg.chat.id;
  const text = msg.text;

  // /start <code> — привязка аккаунта
  if (text && text.startsWith("/start")) {
    const code = text.split(/\s+/)[1];
    if (!code) {
      await sendMessage(
        chatId,
        "Привет! Чтобы получать лиды, привяжите аккаунт: откройте ссылку из раздела «Настройки → Telegram» в Pulse.",
      );
      return;
    }
    const { data: codeRow } = await admin
      .from("telegram_link_codes")
      .select("project_id, user_id")
      .eq("code", code)
      .maybeSingle();
    if (!codeRow) {
      await sendMessage(chatId, "❌ Код не найден или устарел. Сгенерируйте новый в Pulse.");
      return;
    }
    await admin.from("telegram_links").delete().eq("chat_id", chatId);
    await admin
      .from("telegram_links")
      .delete()
      .eq("project_id", codeRow.project_id)
      .eq("user_id", codeRow.user_id);
    await admin.from("telegram_links").insert({
      project_id: codeRow.project_id,
      user_id: codeRow.user_id,
      chat_id: chatId,
      username: msg.from?.username ?? null,
    });
    await admin.from("telegram_link_codes").delete().eq("code", code);

    const { data: profile } = await admin
      .from("profiles")
      .select("full_name")
      .eq("id", codeRow.user_id)
      .maybeSingle();
    await sendMessage(
      chatId,
      `✅ Аккаунт привязан, <b>${profile?.full_name ?? ""}</b>!\nНажмите «Я на смене», чтобы начать получать лиды.`,
      { replyMarkup: shiftKeyboard() },
    );
    return;
  }

  const link = await findLink(admin, chatId);
  if (!link) {
    await sendMessage(chatId, "Аккаунт не привязан. Откройте ссылку привязки из Pulse.");
    return;
  }

  // Геолокация — начать смену с подтверждением офиса
  if (msg.location) {
    const res = await startShift(
      admin,
      link.project_id,
      link.user_id,
      msg.location.latitude,
      msg.location.longitude,
    );
    if (!res.ok) {
      await sendMessage(
        chatId,
        `❌ Вы вне офиса (${Math.round(res.distance ?? 0)} м, допустимо ${res.radius} м). Смена не начата.`,
      );
    } else if (res.already) {
      await sendMessage(chatId, "Вы уже на смене ✅");
    } else {
      await sendMessage(chatId, "✅ Смена начата (вы в офисе). Лиды будут приходить по очереди.");
    }
    return;
  }

  // Начать смену без геолокации (для десктопа / когда офис не задан)
  if (text === "🟢 Начать смену" || text === "/smena") {
    const res = await startShift(admin, link.project_id, link.user_id, null, null);
    if (res.already) {
      await sendMessage(chatId, "Вы уже на смене ✅");
    } else {
      await sendMessage(
        chatId,
        "✅ Смена начата. Лиды будут приходить по очереди.\nЧтобы подтвердить, что вы в офисе, отправьте 📍 геолокацию с телефона.",
      );
    }
    return;
  }

  // Завершить смену
  if (text === "🔚 Ушёл" || text === "/stop") {
    await admin
      .from("shifts")
      .update({ ended_at: new Date().toISOString(), status: "closed" })
      .eq("project_id", link.project_id)
      .eq("user_id", link.user_id)
      .eq("status", "open");
    await sendMessage(chatId, "🔚 Смена завершена. Хорошего отдыха!");
    return;
  }

  await sendMessage(
    chatId,
    "Кнопки: «🟢 Начать смену», «📍 Я в офисе (геолокация)» для подтверждения офиса и «🔚 Ушёл».",
    { replyMarkup: shiftKeyboard() },
  );
}

async function handleCallback(admin: Admin, cb: TgCallback) {
  const chatId = cb.message?.chat?.id;
  const messageId = cb.message?.message_id;
  const [action, leadId] = String(cb.data ?? "").split(":");

  const { data: lead } = await admin
    .from("leads")
    .select("full_name, phone, source")
    .eq("id", leadId)
    .maybeSingle();

  if (!lead) {
    await answerCallback(cb.id, "Лид не найден", true);
    return;
  }

  if (action === "accept") {
    await answerCallback(cb.id, "✅ Лид принят");
    // Перерисовываем карточку: убираем «Принять», показываем «Позвонить»
    if (chatId && messageId) {
      await editMessageText(chatId, messageId, leadCardAccepted(lead), acceptedButtons(leadId));
    }
  } else if (action === "call") {
    await answerCallback(cb.id, lead.phone ?? "Телефон не указан", true);
    if (chatId && lead.phone) await sendMessage(chatId, `📞 ${lead.phone}`);
  } else {
    await answerCallback(cb.id);
  }
}

export async function POST(req: NextRequest) {
  // Проверка секрета вебхука (устанавливается при setWebhook)
  if (
    req.headers.get("x-telegram-bot-api-secret-token") !==
    process.env.TELEGRAM_WEBHOOK_SECRET
  ) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let update: TgUpdate;
  try {
    update = (await req.json()) as TgUpdate;
  } catch {
    return NextResponse.json({ ok: true });
  }

  const admin = createAdminClient();
  try {
    if (update.message) await handleMessage(admin, update.message);
    else if (update.callback_query) await handleCallback(admin, update.callback_query);
  } catch {
    // Никогда не отдаём ошибку Telegram — иначе он будет ретраить
  }
  return NextResponse.json({ ok: true });
}
