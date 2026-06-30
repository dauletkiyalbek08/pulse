"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEffectiveRole } from "@/lib/queries";
import { canAccess } from "@/lib/access";
import { PROJECT_ROLES } from "@/lib/members";

const VALID_ROLES: readonly string[] = PROJECT_ROLES;

export interface CreateEmployeeState {
  error: string | null;
  created: {
    fullName: string;
    role: string;
    email: string;
    password: string;
  } | null;
}

export async function createEmployee(
  projectId: string,
  _prev: CreateEmployeeState,
  formData: FormData,
): Promise<CreateEmployeeState> {
  const fullName = String(formData.get("full_name") ?? "").trim();
  const role = String(formData.get("role") ?? "");

  if (!fullName) return { error: "Введите имя сотрудника", created: null };
  if (!VALID_ROLES.includes(role))
    return { error: "Выберите роль", created: null };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data, error } = await supabase.rpc("create_employee", {
    p_project_id: projectId,
    p_full_name: fullName,
    p_role: role,
  });

  if (error || !data) {
    return {
      error: "Не удалось создать сотрудника. Попробуйте ещё раз.",
      created: null,
    };
  }

  const creds = data as { email: string; password: string };
  revalidatePath(`/p/${projectId}/settings`);
  return {
    error: null,
    created: {
      fullName,
      role,
      email: creds.email,
      password: creds.password,
    },
  };
}

export interface TelegramLinkResult {
  ok: boolean;
  url?: string;
  error?: string;
}

/** Генерирует одноразовую ссылку привязки Telegram для сотрудника. */
export async function genTelegramLink(
  projectId: string,
  userId: string,
): Promise<TelegramLinkResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Нет авторизации" };

  const { data: code, error } = await supabase.rpc("gen_telegram_code", {
    p_project_id: projectId,
    p_user_id: userId,
  });
  if (error || !code) return { ok: false, error: "Нет прав или не удалось создать ссылку" };

  const username = process.env.TELEGRAM_BOT_USERNAME ?? "";
  return { ok: true, url: `https://t.me/${username}?start=${code}` };
}

/** Самоподключение: текущий сотрудник создаёт ссылку привязки для СЕБЯ. */
export async function connectMyTelegram(projectId: string): Promise<TelegramLinkResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Нет авторизации" };

  // gen_telegram_code разрешает v_caller = p_user_id (привязка самому себе).
  const { data: code, error } = await supabase.rpc("gen_telegram_code", {
    p_project_id: projectId,
    p_user_id: user.id,
  });
  if (error || !code) return { ok: false, error: "Не удалось создать ссылку" };

  const username = process.env.TELEGRAM_BOT_USERNAME ?? "";
  return { ok: true, url: `https://t.me/${username}?start=${code}` };
}

export async function fireEmployee(
  projectId: string,
  formData: FormData,
): Promise<void> {
  const memberId = String(formData.get("member_id") ?? "");
  if (!memberId) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Увольнение + запись в журнал — внутри RPC (проверка прав, обход RLS)
  await supabase.rpc("fire_member", { p_member_id: memberId });

  revalidatePath(`/p/${projectId}/settings`);
}

/**
 * Включение/выключение разделов меню для конкретного проекта.
 * Доступно владельцу платформы и директору проекта (у них доступ к "settings").
 * Базовые разделы (Главная/Настройки/Права доступа) выключить нельзя — фильтр в lib/menu.
 */
export async function setProjectModules(
  projectId: string,
  modules: string[],
): Promise<{ ok: boolean; error?: string }> {
  const role = await getEffectiveRole(projectId);
  if (!canAccess(role, "settings")) return { ok: false, error: "Недостаточно прав" };

  const clean = Array.from(new Set(modules.filter((s) => typeof s === "string")));
  const admin = createAdminClient();
  const { error } = await admin.from("projects").update({ modules: clean }).eq("id", projectId);
  if (error) return { ok: false, error: "Не удалось сохранить разделы" };

  // Меню рендерится в layout — обновляем весь раздел проекта.
  revalidatePath(`/p/${projectId}`, "layout");
  return { ok: true };
}
