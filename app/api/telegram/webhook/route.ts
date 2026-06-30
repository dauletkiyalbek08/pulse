import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { haversineMeters } from "@/lib/geo";
import { reassignLead } from "@/lib/lead-dispatch";
import { recordPurchase, type CapiOutcome } from "@/lib/purchase";
import {
  currentPeriod,
  periodLabel,
  periodBounds,
  accruedBase,
  payrollTotal,
  PAYROLL_STATUS,
} from "@/lib/finance";
import {
  sendMessage,
  answerCallback,
  editMessageText,
  shiftKeyboard,
  saleKeyboard,
  cancelKeyboard,
  acceptedButtons,
  leadCardAccepted,
} from "@/lib/telegram";

type Admin = ReturnType<typeof createAdminClient>;

const SELL_ROLES = ["owner", "director", "head_sales", "manager"];

/** Эффективная роль пользователя в проекте (для бота, через admin-клиент). */
async function effectiveRole(
  admin: Admin,
  projectId: string,
  userId: string,
): Promise<string | null> {
  const { data: profile } = await admin
    .from("profiles")
    .select("global_role")
    .eq("id", userId)
    .maybeSingle();
  if (profile?.global_role === "owner") return "owner";
  const { data: project } = await admin
    .from("projects")
    .select("owner_id")
    .eq("id", projectId)
    .maybeSingle();
  if (project?.owner_id === userId) return "director";
  const { data: member } = await admin
    .from("project_members")
    .select("role")
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();
  return member?.role ?? null;
}

/** Клавиатура по роли: хантеру — смена, продавцу — продажа. */
function keyboardForRole(role: string | null) {
  if (role === "hunter") return shiftKeyboard();
  if (role && SELL_ROLES.includes(role)) return saleKeyboard();
  return shiftKeyboard();
}

const normalizePhone = (s: string) => s.replace(/\D/g, "");

/** Найти лид проекта по телефону (сравниваем последние 10 цифр). */
async function findLeadByPhone(admin: Admin, projectId: string, phoneInput: string) {
  const last10 = normalizePhone(phoneInput).slice(-10);
  if (last10.length < 10) return null;
  const { data: leads } = await admin
    .from("leads")
    .select("id, full_name, phone, external_id")
    .eq("project_id", projectId)
    .not("phone", "is", null)
    .order("created_at", { ascending: false })
    .limit(1000);
  for (const l of leads ?? []) {
    if (normalizePhone(l.phone ?? "").slice(-10) === last10) return l;
  }
  return null;
}

/** Текст подтверждения продажи (с учётом результата CAPI). */
function saleConfirmText(name: string, amount: number, capi: CapiOutcome): string {
  const base = `✅ Продажа записана: <b>${name}</b> — ${amount.toLocaleString("ru-RU")} ₸`;
  const tail =
    capi === "sent"
      ? "\n📤 Событие отправлено в Meta (CAPI) — пойдёт в похожие аудитории."
      : capi === "no_lead_id"
        ? "\nℹ️ Лид не с рекламы Meta — в CAPI не отправляли."
        : capi === "error"
          ? "\n⚠️ Покупка записана, но событие в Meta не ушло (ошибка CAPI)."
          : "";
  return base + tail;
}

const money = (n: number | string) => `${Math.round(Number(n)).toLocaleString("ru-RU")} ₸`;

/** Личный расчёт зарплаты/бонуса сотрудника за текущий месяц — текст для бота. */
async function salaryMessage(
  admin: Admin,
  projectId: string,
  userId: string,
  role: string | null,
): Promise<string> {
  const period = currentPeriod();
  const bounds = periodBounds(period);
  const fromTs = `${bounds.from}T00:00:00+05:00`;
  const toTs = `${bounds.toExclusive}T00:00:00+05:00`;

  const { data: pr } = await admin
    .from("payroll")
    .select("base_salary, days_planned, days_worked, kpi_bonus, bonus, deduction, status")
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .eq("period", period)
    .maybeSingle();

  const lines: string[] = [`💵 <b>Зарплата · ${periodLabel(period)}</b>`, ""];

  if (pr) {
    const base = accruedBase(Number(pr.base_salary), pr.days_planned, pr.days_worked);
    const total = payrollTotal({
      base_salary: Number(pr.base_salary),
      days_planned: pr.days_planned,
      days_worked: pr.days_worked,
      kpi_bonus: Number(pr.kpi_bonus),
      bonus: Number(pr.bonus),
      deduction: Number(pr.deduction),
    });
    const status = PAYROLL_STATUS[pr.status] ?? PAYROLL_STATUS.draft;
    lines.push(`Оклад по дням (${pr.days_worked} из ${pr.days_planned}): ${money(base)}`);
    lines.push(`KPI / премия: ${money(pr.kpi_bonus)}`);
    lines.push(`Бонус: ${money(pr.bonus)}`);
    if (Number(pr.deduction) > 0) lines.push(`Удержания: − ${money(pr.deduction)}`);
    lines.push("───────────────");
    lines.push(`<b>К выплате: ${money(total)}</b>`);
    lines.push(`Статус: ${status.label}`);
  } else {
    lines.push("За этот месяц зарплата ещё не рассчитана.");
  }

  // Активность за месяц (для мотивации)
  if (role && SELL_ROLES.includes(role) && role !== "hunter") {
    const { data: sales } = await admin
      .from("sales")
      .select("amount")
      .eq("project_id", projectId)
      .eq("manager_id", userId)
      .gte("created_at", fromTs)
      .lt("created_at", toTs);
    const cnt = sales?.length ?? 0;
    const sum = (sales ?? []).reduce((s, x) => s + Number(x.amount), 0);
    lines.push("", `📊 Продаж в этом месяце: <b>${cnt}</b> на ${money(sum)}`);
  } else if (role === "hunter") {
    const { data: accepted } = await admin
      .from("leads")
      .select("id")
      .eq("project_id", projectId)
      .eq("assigned_to", userId)
      .not("accepted_at", "is", null)
      .gte("accepted_at", fromTs)
      .lt("accepted_at", toTs);
    lines.push("", `📊 Принято лидов в этом месяце: <b>${accepted?.length ?? 0}</b>`);
  }

  return lines.join("\n");
}

/** Личная статистика сотрудника + место в рейтинге команды за текущий месяц. */
async function statsMessage(
  admin: Admin,
  projectId: string,
  userId: string,
  role: string | null,
): Promise<string> {
  const period = currentPeriod();
  const b = periodBounds(period);
  const fromTs = `${b.from}T00:00:00+05:00`;
  const toTs = `${b.toExclusive}T00:00:00+05:00`;
  const head = `📊 <b>Моя статистика · ${periodLabel(period)}</b>`;

  const { data: members } = await admin
    .from("project_members")
    .select("user_id, role")
    .eq("project_id", projectId)
    .eq("status", "active");
  const ids = (members ?? []).map((m) => m.user_id);
  const { data: profiles } = ids.length
    ? await admin.from("profiles").select("id, full_name").in("id", ids)
    : { data: [] as { id: string; full_name: string }[] };
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

  // Хантер — рейтинг по принятым лидам
  if (role === "hunter") {
    const { data: leads } = await admin
      .from("leads")
      .select("assigned_to")
      .eq("project_id", projectId)
      .not("accepted_at", "is", null)
      .gte("accepted_at", fromTs)
      .lt("accepted_at", toTs);
    const cnt = new Map<string, number>();
    for (const l of leads ?? []) if (l.assigned_to) cnt.set(l.assigned_to, (cnt.get(l.assigned_to) ?? 0) + 1);
    const hunterIds = new Set<string>((members ?? []).filter((m) => m.role === "hunter").map((m) => m.user_id));
    hunterIds.add(userId);
    const ranked = [...hunterIds].map((id) => ({ id, n: cnt.get(id) ?? 0 })).sort((a, b) => b.n - a.n);
    const place = ranked.findIndex((r) => r.id === userId) + 1;
    const lines = [head, "", `Принято лидов: <b>${cnt.get(userId) ?? 0}</b>`];
    if (ranked.length > 1) lines.push(`🏆 Место: <b>#${place}</b> из ${ranked.length} хантеров`);
    lines.push("", "<b>Топ хантеров:</b>");
    ranked.slice(0, 3).forEach((r, i) => lines.push(`${i + 1}. ${nameById.get(r.id) ?? "—"} — ${r.n}`));
    return lines.join("\n");
  }

  // Продавцы — рейтинг по сумме продаж
  if (role && SELL_ROLES.includes(role)) {
    const { data: sales } = await admin
      .from("sales")
      .select("manager_id, amount")
      .eq("project_id", projectId)
      .gte("created_at", fromTs)
      .lt("created_at", toTs);
    const agg = new Map<string, { n: number; sum: number }>();
    for (const s of sales ?? []) {
      if (!s.manager_id) continue;
      const cur = agg.get(s.manager_id) ?? { n: 0, sum: 0 };
      cur.n += 1;
      cur.sum += Number(s.amount);
      agg.set(s.manager_id, cur);
    }
    const sellerIds = new Set<string>();
    (members ?? []).filter((m) => SELL_ROLES.includes(m.role)).forEach((m) => sellerIds.add(m.user_id));
    agg.forEach((_, id) => sellerIds.add(id));
    sellerIds.add(userId);
    const ranked = [...sellerIds]
      .map((id) => ({ id, ...(agg.get(id) ?? { n: 0, sum: 0 }) }))
      .sort((a, b) => b.sum - a.sum);
    const mine = agg.get(userId) ?? { n: 0, sum: 0 };
    const place = ranked.findIndex((r) => r.id === userId) + 1;
    const lines = [head, "", `Продаж: <b>${mine.n}</b> на ${money(mine.sum)}`];
    if (mine.n > 0) lines.push(`Средний чек: ${money(Math.round(mine.sum / mine.n))}`);
    if (ranked.length > 1) lines.push(`🏆 Место по продажам: <b>#${place}</b> из ${ranked.length}`);
    lines.push("", "<b>Топ продавцов:</b>");
    ranked.slice(0, 3).forEach((r, i) =>
      lines.push(`${i + 1}. ${nameById.get(r.id) ?? "—"} — ${money(r.sum)} (${r.n})`),
    );
    return lines.join("\n");
  }

  return `${head}\n\nРейтинг доступен продавцам и хантерам.`;
}

async function closeShift(admin: Admin, projectId: string, userId: string) {
  await admin
    .from("shifts")
    .update({ ended_at: new Date().toISOString(), status: "closed" })
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .eq("status", "open");
}

/** Непринятые (assigned, но не accepted) лиды хантера. */
async function pendingLeadIds(admin: Admin, projectId: string, userId: string) {
  const { data } = await admin
    .from("leads")
    .select("id")
    .eq("project_id", projectId)
    .eq("assigned_to", userId)
    .is("accepted_at", null);
  return (data ?? []).map((l) => l.id);
}

interface TgMessage {
  chat: { id: number };
  text?: string;
  from?: { username?: string };
  location?: { latitude: number; longitude: number };
  photo?: { file_id: string; file_unique_id: string }[];
  contact?: { phone_number?: string };
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

/**
 * Поток оформления продажи менеджером (мини-состояние в tg_sale_drafts).
 * Возвращает true, если сообщение относится к продаже (тогда хантерские
 * обработчики пропускаются).
 */
async function handleManagerSale(
  admin: Admin,
  msg: TgMessage,
  link: { project_id: string; user_id: string },
): Promise<boolean> {
  const chatId = msg.chat.id;
  const text = msg.text?.trim();

  // Старт продажи
  if (text === "💰 Оформить продажу") {
    const role = await effectiveRole(admin, link.project_id, link.user_id);
    if (!role || !SELL_ROLES.includes(role)) {
      await sendMessage(chatId, "Оформлять продажи может только менеджер/руководитель.");
      return true;
    }
    await admin.from("tg_sale_drafts").upsert(
      {
        chat_id: chatId,
        project_id: link.project_id,
        user_id: link.user_id,
        step: "phone",
        lead_id: null,
        lead_name: null,
        amount: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "chat_id" },
    );
    await sendMessage(
      chatId,
      "📱 Отправьте <b>номер телефона клиента</b>, который купил курс.",
      { replyMarkup: cancelKeyboard() },
    );
    return true;
  }

  // Отмена
  if (text === "❌ Отмена") {
    const { data: existing } = await admin
      .from("tg_sale_drafts")
      .select("chat_id")
      .eq("chat_id", chatId)
      .maybeSingle();
    if (!existing) return false;
    await admin.from("tg_sale_drafts").delete().eq("chat_id", chatId);
    const role = await effectiveRole(admin, link.project_id, link.user_id);
    await sendMessage(chatId, "Оформление продажи отменено.", { replyMarkup: keyboardForRole(role) });
    return true;
  }

  // Активный черновик?
  const { data: draft } = await admin
    .from("tg_sale_drafts")
    .select("step, lead_id, lead_name, amount")
    .eq("chat_id", chatId)
    .maybeSingle();
  if (!draft) return false;

  // Шаг 1 — телефон (текстом или пересланным контактом)
  if (draft.step === "phone") {
    const phoneInput = text || msg.contact?.phone_number?.trim();
    if (!phoneInput) {
      await sendMessage(chatId, "Отправьте номер телефона текстом (например +7 705 123 45 67) или перешлите контакт.", {
        replyMarkup: cancelKeyboard(),
      });
      return true;
    }
    const lead = await findLeadByPhone(admin, link.project_id, phoneInput);
    if (!lead) {
      await sendMessage(
        chatId,
        `❌ Лид с номером <b>${phoneInput}</b> не найден в проекте. Проверьте номер и отправьте ещё раз, или «❌ Отмена».`,
        { replyMarkup: cancelKeyboard() },
      );
      return true;
    }
    await admin
      .from("tg_sale_drafts")
      .update({ step: "amount", lead_id: lead.id, lead_name: lead.full_name, updated_at: new Date().toISOString() })
      .eq("chat_id", chatId);
    await sendMessage(
      chatId,
      `Клиент: <b>${lead.full_name}</b>.\n💰 Введите <b>сумму покупки в ₸</b> (например 120000).`,
      { replyMarkup: cancelKeyboard() },
    );
    return true;
  }

  // Шаг 2 — сумма
  if (draft.step === "amount") {
    const amount = Number((text ?? "").replace(/[^\d.]/g, ""));
    if (!(amount > 0)) {
      await sendMessage(chatId, "Введите сумму числом, например 120000.", { replyMarkup: cancelKeyboard() });
      return true;
    }
    await admin
      .from("tg_sale_drafts")
      .update({ step: "receipt", amount, updated_at: new Date().toISOString() })
      .eq("chat_id", chatId);
    await sendMessage(chatId, "🧾 Прикрепите <b>фото чека</b> — или отправьте «пропустить».", {
      replyMarkup: cancelKeyboard(),
    });
    return true;
  }

  // Шаг 3 — чек (фото) или «пропустить» → запись продажи + CAPI
  if (draft.step === "receipt") {
    const skip = !!text && /^пропустить$/i.test(text);
    const receiptFileId = msg.photo?.length ? msg.photo[msg.photo.length - 1].file_id : null;
    if (!receiptFileId && !skip) {
      await sendMessage(chatId, "Пришлите фото чека или напишите «пропустить».", { replyMarkup: cancelKeyboard() });
      return true;
    }
    if (!draft.lead_id || !(Number(draft.amount) > 0)) {
      await admin.from("tg_sale_drafts").delete().eq("chat_id", chatId);
      await sendMessage(chatId, "Черновик повреждён. Начните заново: «💰 Оформить продажу».", {
        replyMarkup: saleKeyboard(),
      });
      return true;
    }
    const res = await recordPurchase(admin, {
      projectId: link.project_id,
      leadId: draft.lead_id,
      managerId: link.user_id,
      amount: Number(draft.amount),
      receiptFileId,
    });
    await admin.from("tg_sale_drafts").delete().eq("chat_id", chatId);
    if (!res.ok) {
      await sendMessage(chatId, `❌ Не удалось записать продажу: ${res.error}`, { replyMarkup: saleKeyboard() });
      return true;
    }
    await sendMessage(chatId, saleConfirmText(draft.lead_name ?? "клиент", Number(draft.amount), res.capi), {
      replyMarkup: saleKeyboard(),
    });
    return true;
  }

  return false;
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
    const role = await effectiveRole(admin, codeRow.project_id, codeRow.user_id);
    const hint =
      role && SELL_ROLES.includes(role) && role !== "hunter"
        ? "Нажмите «💰 Оформить продажу», когда клиент купит курс."
        : "Нажмите «Я на смене», чтобы начать получать лиды.";
    await sendMessage(
      chatId,
      `✅ Аккаунт привязан, <b>${profile?.full_name ?? ""}</b>!\n${hint}`,
      { replyMarkup: keyboardForRole(role) },
    );
    return;
  }

  const link = await findLink(admin, chatId);
  if (!link) {
    await sendMessage(chatId, "Аккаунт не привязан. Откройте ссылку привязки из Pulse.");
    return;
  }

  // «Моя зарплата» — доступно всем, даже посреди оформления продажи
  if (text === "💵 Моя зарплата") {
    const role = await effectiveRole(admin, link.project_id, link.user_id);
    await sendMessage(chatId, await salaryMessage(admin, link.project_id, link.user_id, role), {
      replyMarkup: keyboardForRole(role),
    });
    return;
  }

  // «Моя статистика» — личные цифры + место в рейтинге команды
  if (text === "📊 Моя статистика") {
    const role = await effectiveRole(admin, link.project_id, link.user_id);
    await sendMessage(chatId, await statsMessage(admin, link.project_id, link.user_id, role), {
      replyMarkup: keyboardForRole(role),
    });
    return;
  }

  // Поток оформления продажи (менеджер) — обрабатываем до хантерских кнопок
  if (await handleManagerSale(admin, msg, link)) return;

  // Геолокация (нажата кнопка «🟢 Начать смену») — старт смены с проверкой офиса
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
      const where = res.distance != null ? ` (в офисе, ${Math.round(res.distance)} м)` : "";
      await sendMessage(chatId, `✅ Смена начата${where}. Лиды будут приходить по очереди.`);
    }
    return;
  }

  // Начать смену без геолокации — только если у проекта НЕ задан офис.
  // Если офис задан — начать смену можно лишь по геолокации (подтверждение офиса).
  if (text === "🟢 Начать смену" || text === "/smena") {
    const { data: proj } = await admin
      .from("projects")
      .select("office_lat, office_lng")
      .eq("id", link.project_id)
      .maybeSingle();
    const officeSet = proj?.office_lat != null && proj?.office_lng != null;

    if (officeSet) {
      await sendMessage(
        chatId,
        "📍 Нажмите кнопку «🟢 Начать смену» — Telegram попросит отправить геолокацию, и мы подтвердим, что вы в офисе.",
        { replyMarkup: shiftKeyboard() },
      );
      return;
    }

    const res = await startShift(admin, link.project_id, link.user_id, null, null);
    if (res.already) {
      await sendMessage(chatId, "Вы уже на смене ✅");
    } else {
      await sendMessage(chatId, "✅ Смена начата. Лиды будут приходить по очереди.");
    }
    return;
  }

  // Завершить смену — если есть непринятые лиды, сначала спросить про передачу
  if (text === "🔚 Ушёл" || text === "/stop") {
    const pending = await pendingLeadIds(admin, link.project_id, link.user_id);
    if (pending.length > 0) {
      await sendMessage(
        chatId,
        `У вас ${pending.length} непринятых лид(ов). Передать их другому хантеру и завершить смену?`,
        {
          buttons: [
            [
              { text: "✅ Передать и уйти", callback_data: "leave_transfer" },
              { text: "↩️ Остаться", callback_data: "leave_cancel" },
            ],
          ],
        },
      );
      return;
    }
    await closeShift(admin, link.project_id, link.user_id);
    await sendMessage(chatId, "🔚 Смена завершена. Хорошего отдыха!");
    return;
  }

  const role = await effectiveRole(admin, link.project_id, link.user_id);
  if (role && SELL_ROLES.includes(role) && role !== "hunter") {
    await sendMessage(chatId, "Нажмите «💰 Оформить продажу», чтобы записать покупку клиента.", {
      replyMarkup: saleKeyboard(),
    });
  } else {
    await sendMessage(
      chatId,
      "Кнопки: «🟢 Начать смену» (отправит геолокацию и подтвердит офис) и «🔚 Ушёл».",
      { replyMarkup: shiftKeyboard() },
    );
  }
}

async function handleCallback(admin: Admin, cb: TgCallback) {
  const chatId = cb.message?.chat?.id;
  const messageId = cb.message?.message_id;
  const [action, leadId] = String(cb.data ?? "").split(":");

  // Уход со смены с непринятыми лидами
  if (action === "leave_transfer" || action === "leave_cancel") {
    const link = chatId ? await findLink(admin, chatId) : null;
    if (!link) {
      await answerCallback(cb.id);
      return;
    }
    if (action === "leave_cancel") {
      await answerCallback(cb.id, "Остаётесь на смене");
      if (chatId && messageId) await editMessageText(chatId, messageId, "↩️ Вы остаётесь на смене.");
      return;
    }
    await answerCallback(cb.id, "Передаю лиды…");
    const pending = await pendingLeadIds(admin, link.project_id, link.user_id);
    let moved = 0;
    for (const id of pending) {
      if (await reassignLead(admin, link.project_id, id, link.user_id)) moved++;
    }
    await closeShift(admin, link.project_id, link.user_id);
    if (chatId && messageId) {
      await editMessageText(
        chatId,
        messageId,
        `🔚 Смена завершена. Передано лидов: ${moved}${moved < pending.length ? ` (остальные некому передать)` : ""}.`,
      );
    }
    return;
  }

  // accept / call — нужен лид
  const link = chatId ? await findLink(admin, chatId) : null;
  const { data: lead } = await admin
    .from("leads")
    .select("assigned_to, status, full_name, phone, source")
    .eq("id", leadId)
    .maybeSingle();

  if (!lead) {
    await answerCallback(cb.id, "Лид не найден", true);
    return;
  }

  if (action === "accept") {
    // Принять можно только если лид всё ещё закреплён за этим хантером
    if (link && lead.assigned_to && lead.assigned_to !== link.user_id) {
      await answerCallback(cb.id, "Этот лид уже передан другому хантеру", true);
      if (chatId && messageId) await editMessageText(chatId, messageId, "⏭ Лид передан другому хантеру.");
      return;
    }
    // Принятие двигает лид в воронке: Новый → Назначен
    await admin
      .from("leads")
      .update({
        accepted_at: new Date().toISOString(),
        status: lead.status === "new" ? "assigned" : lead.status,
      })
      .eq("id", leadId);
    await answerCallback(cb.id, "✅ Лид принят");
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
