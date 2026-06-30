"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEffectiveRole } from "@/lib/queries";
import { canAccess } from "@/lib/access";

const PATH = (p: string) => `/p/${p}/products`;

async function canManage(projectId: string): Promise<boolean> {
  const role = await getEffectiveRole(projectId);
  return canAccess(role, "products");
}

const toInt = (v: FormDataEntryValue | null, def = 0) => {
  const n = parseInt(String(v ?? "").trim(), 10);
  return Number.isFinite(n) && n >= 0 ? n : def;
};
const toMoney = (v: FormDataEntryValue | null, def = 0) => {
  const n = Number(String(v ?? "").trim().replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : def;
};

export async function addProduct(
  projectId: string,
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  if (!(await canManage(projectId))) return { ok: false, error: "Недостаточно прав" };

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { ok: false, error: "Введите название товара" };

  const admin = createAdminClient();
  const { error } = await admin.from("products").insert({
    project_id: projectId,
    name,
    sku: String(formData.get("sku") ?? "").trim() || null,
    stock_quantity: toInt(formData.get("stock_quantity")),
    cost_price: toMoney(formData.get("cost_price")),
    sale_price: toMoney(formData.get("sale_price")),
    low_stock_threshold: toInt(formData.get("low_stock_threshold"), 5),
  });
  if (error) return { ok: false, error: "Не удалось добавить товар" };

  revalidatePath(PATH(projectId));
  return { ok: true };
}

export interface ProductPatch {
  name?: string;
  sku?: string | null;
  stock_quantity?: number;
  cost_price?: number;
  sale_price?: number;
  low_stock_threshold?: number;
}

export async function updateProduct(
  projectId: string,
  id: string,
  patch: ProductPatch,
): Promise<{ ok: boolean }> {
  if (!(await canManage(projectId))) return { ok: false };
  const admin = createAdminClient();
  await admin.from("products").update(patch).eq("project_id", projectId).eq("id", id);
  revalidatePath(PATH(projectId));
  return { ok: true };
}

/** Быстрое изменение остатка на складе (приход +, расход −). */
export async function adjustStock(
  projectId: string,
  id: string,
  delta: number,
): Promise<{ ok: boolean }> {
  if (!(await canManage(projectId))) return { ok: false };
  const admin = createAdminClient();
  const { data } = await admin
    .from("products")
    .select("stock_quantity")
    .eq("project_id", projectId)
    .eq("id", id)
    .maybeSingle();
  if (!data) return { ok: false };
  const next = Math.max(0, data.stock_quantity + delta);
  await admin.from("products").update({ stock_quantity: next }).eq("project_id", projectId).eq("id", id);
  revalidatePath(PATH(projectId));
  return { ok: true };
}

export async function deleteProduct(projectId: string, id: string): Promise<{ ok: boolean }> {
  if (!(await canManage(projectId))) return { ok: false };
  const admin = createAdminClient();
  await admin.from("products").delete().eq("project_id", projectId).eq("id", id);
  revalidatePath(PATH(projectId));
  return { ok: true };
}
