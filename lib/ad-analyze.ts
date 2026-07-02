/**
 * Авто-анализ авто-кампаний (v2): раз в день крон смотрит расход/лиды каждой
 * запущенной через Pulse кампании, считает CPL и присылает в бот СОВЕТ с кнопками
 * (поднять бюджет / остановить). Меняет что-либо только по нажатию пользователя.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { decryptSecret } from "@/lib/crypto";
import { fetchCampaignInsights, fetchCampaignSyncStatus } from "@/lib/meta";
import { sendMessage, type InlineButton } from "@/lib/telegram";
import { almatyYmd } from "@/lib/reports-tg";

type Admin = ReturnType<typeof createAdminClient>;

// Пороги (целевой CPL курса — до $3). Настраиваемо при желании.
const GOOD_CPL = 3; // дешевле — предлагаем поднять бюджет
const BAD_CPL = 5; // дороже — предлагаем остановить
const MIN_SPEND_JUDGE = 3; // пока потрачено меньше — рано судить
const NO_LEAD_STOP_SPEND = 5; // потрачено столько без лидов — предлагаем стоп

const usd = (n: number) => `$${(Math.round(n * 100) / 100).toFixed(2)}`;

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
    const cpl = leads > 0 ? spend / leads : 0;
    const label = l.headline ? `«${l.headline}»` : "авто-кампания";

    let action: "raise" | "stop" | null = null;
    let text = "";
    if (leads === 0 && spend >= NO_LEAD_STOP_SPEND) {
      action = "stop";
      text = `⚠️ ${label}: потрачено ${usd(spend)}, лидов пока <b>0</b>. Похоже, не заходит — остановить?`;
    } else if (leads > 0 && cpl <= GOOD_CPL) {
      action = "raise";
      text = `📈 ${label} работает хорошо: CPL <b>${usd(cpl)}</b> (лидов ${leads}, потрачено ${usd(spend)}). Поднять бюджет и масштабировать?`;
    } else if (leads > 0 && cpl > BAD_CPL) {
      action = "stop";
      text = `⚠️ ${label}: CPL <b>${usd(cpl)}</b> дороговат (лидов ${leads}, потрачено ${usd(spend)}). Остановить?`;
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
