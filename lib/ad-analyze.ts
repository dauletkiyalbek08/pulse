/**
 * Авто-анализ авто-кампаний (v3): раз в день крон смотрит расход/лиды/ПРОДАЖИ
 * каждой запущенной через Pulse кампании. Есть продажи → судим по окупаемости
 * (ROAS), нет продаж → по лидам/CPL. Присылает в бот СОВЕТ с кнопками
 * (поднять бюджет / остановить). Меняет что-либо только по нажатию пользователя.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { decryptSecret } from "@/lib/crypto";
import { fetchCampaignInsights, fetchCampaignSyncStatus } from "@/lib/meta";
import { getRevenueByCampaign } from "@/lib/ad-revenue";
import { sendMessage, type InlineButton } from "@/lib/telegram";
import { almatyYmd } from "@/lib/reports-tg";

type Admin = ReturnType<typeof createAdminClient>;

// Пороги. Приоритет — деньги (ROAS): есть продажи → судим по окупаемости.
const GOOD_ROAS = 2; // выручка вдвое+ расхода — предлагаем масштаб
const BAD_ROAS = 1; // выручка меньше расхода — в минус, предлагаем стоп
const MIN_SPEND_JUDGE = 3; // пока потрачено меньше — рано судить
const NO_LEAD_STOP_SPEND = 5; // потрачено столько без лидов — предлагаем стоп
const NO_SALE_STOP_SPEND = 15; // потрачено столько без единой продажи — предлагаем стоп

const usd = (n: number) => `$${(Math.round(n * 100) / 100).toFixed(2)}`;
const kzt = (n: number) => `${Math.round(n).toLocaleString("ru-RU")} ₸`;

/** Чат для уведомления: чат запуска или Telegram создателя в этом проекте. */
async function notifyChat(admin: Admin, launch: { chat_id: number | null; project_id: string; created_by: string | null }) {
  if (launch.chat_id) return launch.chat_id;
  if (launch.created_by) {
    const { data } = await admin
      .from("telegram_links")
      .select("chat_id")
      .eq("project_id", launch.project_id)
      .eq("user_id", launch.created_by)
      .maybeSingle();
    return data?.chat_id ?? null;
  }
  return null;
}

export async function runAdAnalysis(admin: Admin): Promise<{ checked: number; notified: number }> {
  const until = almatyYmd();
  const since14 = new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10);

  // Активные авто-кампании за последние 14 дней, по которым ещё не всё предложено
  const { data: launches } = await admin
    .from("ad_launches")
    .select("id, project_id, purpose, chat_id, created_by, campaign_id, adset_id, headline, budget_usd, created_at, raise_suggested, stop_suggested")
    .eq("status", "active")
    .not("campaign_id", "is", null)
    .gte("created_at", since14);

  if (!launches || launches.length === 0) return { checked: 0, notified: 0 };

  // Токены по проектам (по одному разу)
  const tokenByProject = new Map<string, string | null>();
  async function tokenFor(projectId: string, purpose: string): Promise<string | null> {
    const key = `${projectId}:${purpose}`;
    if (tokenByProject.has(key)) return tokenByProject.get(key) ?? null;
    const { data } = await admin
      .from("meta_integration")
      .select("token_enc")
      .eq("project_id", projectId)
      .eq("purpose", purpose)
      .maybeSingle();
    let tok: string | null = null;
    try {
      tok = data?.token_enc ? decryptSecret(data.token_enc) : null;
    } catch {
      tok = null;
    }
    tokenByProject.set(key, tok);
    return tok;
  }

  // Курс ₸/$ по проекту (для ROAS), по одному разу.
  const rateByProject = new Map<string, number>();
  async function rateFor(projectId: string): Promise<number> {
    if (rateByProject.has(projectId)) return rateByProject.get(projectId) as number;
    const { data } = await admin.from("projects").select("usd_rate").eq("id", projectId).maybeSingle();
    const rate = Number(data?.usd_rate ?? 500);
    rateByProject.set(projectId, rate);
    return rate;
  }

  let notified = 0;

  for (const l of launches) {
    if (l.raise_suggested && l.stop_suggested) continue;
    const token = await tokenFor(l.project_id, l.purpose);
    if (!token || !l.campaign_id) continue;

    // Синхронизация с Meta: пропускаем удалённые/остановленные вручную
    const synced = await fetchCampaignSyncStatus(token, l.campaign_id);
    if (synced !== "active") {
      await admin.from("ad_launches").update({ status: synced }).eq("id", l.id);
      continue;
    }

    const since = String(l.created_at).slice(0, 10);
    let spend = 0;
    let leads = 0;
    try {
      const s = await fetchCampaignInsights(token, l.campaign_id, since < since14 ? since14 : since, until);
      spend = s.spend;
      leads = s.leads;
    } catch {
      continue;
    }

    await admin.from("ad_launches").update({ analyzed_at: new Date().toISOString() }).eq("id", l.id);

    if (spend < MIN_SPEND_JUDGE) continue; // рано судить

    // Выручка/продажи по кампании (реклама → лид → продажа) и ROAS.
    const rev = (await getRevenueByCampaign(admin, l.project_id, [l.campaign_id])).get(l.campaign_id) ?? {
      sales: 0,
      revenue: 0,
    };
    const usdRate = await rateFor(l.project_id);
    const spendKzt = spend * usdRate;
    const roas = spendKzt > 0 ? rev.revenue / spendKzt : 0;
    const label = l.headline ? `«${l.headline}»` : "авто-кампания";

    let action: "raise" | "stop" | null = null;
    let text = "";
    if (rev.sales > 0) {
      // Есть продажи — судим по деньгам (ROAS).
      if (roas >= GOOD_ROAS) {
        action = "raise";
        text = `💰 ${label} прибыльная: продаж <b>${rev.sales}</b>, выручка ${kzt(rev.revenue)} при расходе ${usd(spend)} — ROAS <b>${roas.toFixed(1)}×</b>. Поднять бюджет и масштабировать?`;
      } else if (roas < BAD_ROAS) {
        action = "stop";
        text = `⚠️ ${label} в минус: выручка ${kzt(rev.revenue)} меньше расхода (${usd(spend)}), ROAS <b>${roas.toFixed(1)}×</b> (продаж ${rev.sales}). Остановить?`;
      }
      // 1×–2× — окупается, не трогаем.
    } else {
      // Продаж ещё нет — следим, чтобы не сливать бюджет.
      if (spend >= NO_SALE_STOP_SPEND) {
        action = "stop";
        text = `⚠️ ${label}: потрачено ${usd(spend)}, продаж пока <b>0</b> (лидов ${leads}). Не окупается — остановить?`;
      } else if (leads === 0 && spend >= NO_LEAD_STOP_SPEND) {
        action = "stop";
        text = `⚠️ ${label}: потрачено ${usd(spend)}, лидов <b>0</b>. Похоже, не заходит — остановить?`;
      }
      // Лиды идут, но продаж ещё нет — вслепую не масштабируем,
      // ждём первую продажу как сигнал окупаемости.
    }

    if (!action) continue;
    if (action === "raise" && l.raise_suggested) continue;
    if (action === "stop" && l.stop_suggested) continue;

    const chatId = await notifyChat(admin, l);
    if (!chatId) continue;

    const buttons: InlineButton[][] =
      action === "raise"
        ? [
            [{ text: "📈 Поднять бюджет +50%", callback_data: `araise:${l.id}` }],
            [{ text: "Оставить как есть", callback_data: `adismiss:${l.id}` }],
          ]
        : [
            [{ text: "🛑 Остановить", callback_data: `astop:${l.id}` }],
            [{ text: "Оставить как есть", callback_data: `adismiss:${l.id}` }],
          ];

    await sendMessage(chatId, `📊 <b>Анализ рекламы</b>\n\n${text}`, { buttons });
    await admin
      .from("ad_launches")
      .update(action === "raise" ? { raise_suggested: true } : { stop_suggested: true })
      .eq("id", l.id);
    notified += 1;
  }

  return { checked: launches.length, notified };
}
