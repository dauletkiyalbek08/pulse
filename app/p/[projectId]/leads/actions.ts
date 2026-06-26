"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface NewLeadState {
  error: string | null;
  ok: boolean;
}

export async function createLead(
  projectId: string,
  _prev: NewLeadState,
  formData: FormData,
): Promise<NewLeadState> {
  const fullName = String(formData.get("full_name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const source = String(formData.get("source") ?? "other");
  const valueRaw = String(formData.get("value") ?? "").replace(/[^\d.]/g, "");
  const value = valueRaw ? Number(valueRaw) : 0;

  if (!fullName) return { error: "Введите имя лида", ok: false };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase.from("leads").insert({
    project_id: projectId,
    full_name: fullName,
    phone: phone || null,
    source,
    status: "new",
    value: Number.isFinite(value) ? value : 0,
  });

  if (error) return { error: "Не удалось добавить лид. Попробуйте ещё раз.", ok: false };

  revalidatePath(`/p/${projectId}/leads`);
  return { error: null, ok: true };
}
