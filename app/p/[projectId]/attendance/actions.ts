"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getProject, getEffectiveRole } from "@/lib/queries";
import { haversineMeters } from "@/lib/geo";

export interface ShiftResult {
  ok: boolean;
  error?: string;
  distance?: number;
}

const MANAGER_ROLES = ["owner", "director", "head_sales"];

/** Начать смену: проверяем геолокацию относительно офиса проекта. */
export async function startShift(
  projectId: string,
  lat: number,
  lng: number,
): Promise<ShiftResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Нет авторизации" };

  const role = await getEffectiveRole(projectId);
  if (!role) return { ok: false, error: "Вы не участник проекта" };

  const project = await getProject(projectId);
  if (!project) return { ok: false, error: "Проект не найден" };

  // Если офис задан — проверяем расстояние
  let distance: number | null = null;
  if (project.office_lat != null && project.office_lng != null) {
    distance = haversineMeters(
      Number(project.office_lat),
      Number(project.office_lng),
      lat,
      lng,
    );
    if (distance > project.office_radius_m) {
      return {
        ok: false,
        error: `Вы вне офиса (${Math.round(distance)} м от точки, допустимо ${project.office_radius_m} м)`,
        distance,
      };
    }
  }

  // Уже есть открытая смена?
  const { data: open } = await supabase
    .from("shifts")
    .select("id")
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .eq("status", "open")
    .maybeSingle();
  if (open) return { ok: true, distance: distance ?? undefined };

  const { error } = await supabase.from("shifts").insert({
    project_id: projectId,
    user_id: user.id,
    start_lat: lat,
    start_lng: lng,
    start_distance_m: distance,
    status: "open",
  });
  if (error) return { ok: false, error: "Не удалось начать смену" };

  revalidatePath(`/p/${projectId}/attendance`);
  return { ok: true, distance: distance ?? undefined };
}

/** Завершить текущую открытую смену. */
export async function endShift(projectId: string): Promise<ShiftResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Нет авторизации" };

  const { error } = await supabase
    .from("shifts")
    .update({ ended_at: new Date().toISOString(), status: "closed" })
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .eq("status", "open");
  if (error) return { ok: false, error: "Не удалось завершить смену" };

  revalidatePath(`/p/${projectId}/attendance`);
  return { ok: true };
}

/** Сохранить точку офиса (директор/РОП). */
export async function saveOffice(
  projectId: string,
  lat: number,
  lng: number,
  radius: number,
  address: string,
): Promise<ShiftResult> {
  const role = await getEffectiveRole(projectId);
  if (!role || !MANAGER_ROLES.includes(role)) {
    return { ok: false, error: "Недостаточно прав" };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_office", {
    p_project_id: projectId,
    p_lat: lat,
    p_lng: lng,
    p_radius: Math.round(radius),
    p_address: address || "",
  });
  if (error) return { ok: false, error: "Не удалось сохранить офис" };

  revalidatePath(`/p/${projectId}/attendance`);
  return { ok: true };
}
