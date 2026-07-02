import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { pickNextHunter } from "@/lib/distribution";
import { assignLead } from "@/lib/lead-dispatch";

/**
 * Приём заявок с сайта (вебхук Tilda и др.).
 * URL: /api/site/leads?t=<project.site_token>
 * Заявка → lead (source='site') с привязкой к рекламе через fbc/fbp →
 * раздача хантеру на смене + Telegram. При покупке по такому лиду CAPI
 * отправит Purchase по fbc/fbp (см. lib/purchase.ts).
 */

function pick(m: Record<string, string>, keys: string[]): string {
  for (const k of keys) {
    const v = m[k];
    if (v && v.trim()) return v.trim();
  }
  return "";
}

async function parseBody(req: NextRequest): Promise<Record<string, string>> {
  const ct = req.headers.get("content-type") || "";
  const out: Record<string, string> = {};
  try {
    if (ct.includes("application/json")) {
      const j = (await req.json()) as Record<string, unknown>;
      for (const [k, v] of Object.entries(j)) out[k.toLowerCase()] = v == null ? "" : String(v);
    } else {
      const fd = await req.formData();
      for (const [k, v] of fd.entries()) out[k.toLowerCase()] = typeof v === "string" ? v : "";
    }
  } catch {
    // ignore — вернём пустую карту, обработается как «нет данных»
  }
  return out;
}

export async function POST(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("t");
  if (!token) return NextResponse.json({ ok: true }); // нет токена — игнор

  const admin = createAdminClient();
  const { data: project } = await admin
    .from("projects")
    .select("id")
    .eq("site_token", token)
    .maybeSingle();
  if (!project) return NextResponse.json({ ok: true }); // неизвестный токен — тихо игнор

  const m = await parseBody(req);

  const name = pick(m, ["name", "имя", "fio", "фио"]);
  const phone = pick(m, ["phone", "телефон", "тел", "phone_number", "tel"]);
  const email = pick(m, ["email", "e-mail", "почта", "mail"]);
  const note = pick(m, ["note", "quiz", "comment", "комментарий"]);
  let fbc = pick(m, ["fbc", "_fbc"]);
  const fbp = pick(m, ["fbp", "_fbp"]);
  const fbclid = pick(m, ["fbclid"]);
  // Метки атрибуции из URL: c/as/ad (макросы Meta) и cr — НАША метка креатива.
  let campaignId = pick(m, ["c", "campaign_id"]);
  let adsetId = pick(m, ["as", "adset_id"]);
  let adId = pick(m, ["ad", "ad_id"]);
  const cr = pick(m, ["cr"]);

  // cr = id креатива (ad_launch_media) → надёжно определяем кампанию/объявление.
  if (cr) {
    const { data: media } = await admin
      .from("ad_launch_media")
      .select("meta_ad_id, launch_id")
      .eq("id", cr)
      .maybeSingle();
    if (media) {
      if (media.meta_ad_id) adId = media.meta_ad_id;
      const { data: launch } = await admin
        .from("ad_launches")
        .select("campaign_id, adset_id")
        .eq("id", media.launch_id)
        .eq("project_id", project.id)
        .maybeSingle();
      if (launch?.campaign_id) campaignId = launch.campaign_id;
      if (launch?.adset_id) adsetId = launch.adset_id;
    }
  }

  // Тестовый запрос Tilda / пустая отправка — без имени и телефона ничего не создаём.
  if (!name && !phone) return NextResponse.json({ ok: true });

  // Если есть только fbclid — соберём fbc в формате Meta (fb.1.<ts>.<fbclid>).
  if (!fbc && fbclid) fbc = `fb.1.${Math.floor(Date.now() / 1000)}.${fbclid}`;

  const { data: inserted } = await admin
    .from("leads")
    .insert({
      project_id: project.id,
      full_name: name || "Заявка с сайта",
      phone: phone || null,
      source: "site",
      status: "new",
      fbc: fbc || null,
      fbp: fbp || null,
      note: note || null,
      campaign_id: campaignId || null,
      adset_id: adsetId || null,
      ad_id: adId || null,
    })
    .select("id")
    .maybeSingle();
  if (!inserted) return NextResponse.json({ ok: true });

  // Раздача хантеру на смене (round-robin) + уведомление в Telegram.
  // Если на смене никого — лид остаётся «Новый», РОП раздаст вручную.
  try {
    const hunter = await pickNextHunter(admin, project.id);
    if (hunter) await assignLead(admin, project.id, inserted.id, hunter);
  } catch {
    // раздача не критична для приёма заявки
  }

  return NextResponse.json({ ok: true });
}
