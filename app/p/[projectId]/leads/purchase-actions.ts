"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEffectiveRole } from "@/lib/queries";
import { recordPurchase, type CapiOutcome } from "@/lib/purchase";

const SELL_ROLES = ["owner", "director", "head_sales", "manager"];

export interface MarkPurchaseResult {
  ok: boolean;
  error?: string;
  capi?: CapiOutcome;
  capiMessage?: string;
}

/**
 * Отметить покупку по лиду: продажа + лид в «Продажа» + (для лидов с рекламы)
 * событие Purchase в Meta CAPI. Общая логика — в lib/purchase.ts.
 */
export async function markPurchase(
  projectId: string,
  leadId: string,
  amount: number,
  product: string,
): Promise<MarkPurchaseResult> {
  const role = await getEffectiveRole(projectId);
  if (!role || !SELL_ROLES.includes(role)) return { ok: false, error: "Недостаточно прав" };
  if (!(amount > 0)) return { ok: false, error: "Укажите сумму покупки" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const admin = createAdminClient();
  const res = await recordPurchase(admin, {
    projectId,
    leadId,
    managerId: user?.id ?? null,
    amount,
    product,
  });
  if (!res.ok) return { ok: false, error: res.error };

  revalidatePath(`/p/${projectId}/leads`);
  revalidatePath(`/p/${projectId}/sales`);
  revalidatePath(`/p/${projectId}/capi`);
  return { ok: true, capi: res.capi, capiMessage: res.capiMessage };
}
