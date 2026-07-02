import { createAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createAdminClient>;

export interface CampaignRevenue {
  sales: number;
  revenue: number;
}

/**
 * Выручка и число продаж по кампаниям Meta (атрибуция реклама → лид → продажа).
 * Лид тегируется campaign_id (лид-формы Meta или лендинг через url_tags),
 * продажа ссылается на lead_id. Возвращает map campaign_id → {sales, revenue}.
 */
export async function getRevenueByCampaign(
  admin: Admin,
  projectId: string,
  campaignIds: string[],
): Promise<Map<string, CampaignRevenue>> {
  const out = new Map<string, CampaignRevenue>();
  const ids = campaignIds.filter(Boolean);
  if (ids.length === 0) return out;

  // Лиды этих кампаний: id → campaign_id
  const { data: leads } = await admin
    .from("leads")
    .select("id, campaign_id")
    .eq("project_id", projectId)
    .in("campaign_id", ids);
  if (!leads || leads.length === 0) return out;

  const leadToCampaign = new Map<string, string>();
  for (const l of leads) {
    if (l.campaign_id) leadToCampaign.set(l.id, l.campaign_id);
  }
  const leadIds = [...leadToCampaign.keys()];
  if (leadIds.length === 0) return out;

  // Продажи по этим лидам
  const { data: sales } = await admin
    .from("sales")
    .select("lead_id, amount")
    .eq("project_id", projectId)
    .in("lead_id", leadIds);

  for (const s of sales ?? []) {
    if (!s.lead_id) continue;
    const camp = leadToCampaign.get(s.lead_id);
    if (!camp) continue;
    const cur = out.get(camp) ?? { sales: 0, revenue: 0 };
    cur.sales += 1;
    cur.revenue += Number(s.amount) || 0;
    out.set(camp, cur);
  }
  return out;
}
