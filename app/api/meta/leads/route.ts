import { NextResponse, type NextRequest } from "next/server";
import crypto from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptSecret } from "@/lib/crypto";
import { fetchLead } from "@/lib/meta";
import { pickNextHunter } from "@/lib/distribution";
import { assignLead } from "@/lib/lead-dispatch";

type Admin = ReturnType<typeof createAdminClient>;

interface LeadgenValue {
  leadgen_id?: string;
  form_id?: string;
  ad_id?: string;
  adgroup_id?: string;
  campaign_id?: string;
}
interface WebhookBody {
  object?: string;
  entry?: { id: string; changes?: { field: string; value: LeadgenValue }[] }[];
}

/** GET — верификация подписки вебхука (Meta присылает hub.challenge). */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  if (
    sp.get("hub.mode") === "subscribe" &&
    sp.get("hub.verify_token") === process.env.META_VERIFY_TOKEN
  ) {
    return new Response(sp.get("hub.challenge") ?? "", { status: 200 });
  }
  return new Response("Forbidden", { status: 403 });
}

/** Достаёт токен интеграции проекта (для чтения заявки), приоритет — кабинет «Курс». */
async function projectToken(admin: Admin, projectId: string): Promise<string | null> {
  const { data } = await admin
    .from("meta_integration")
    .select("purpose, token_enc")
    .eq("project_id", projectId);
  if (!data || data.length === 0) return null;
  const row = data.find((r) => r.purpose === "course") ?? data[0];
  try {
    return decryptSecret(row.token_enc);
  } catch {
    return null;
  }
}

async function handleLeadgen(admin: Admin, pageId: string, value: LeadgenValue) {
  const leadgenId = value.leadgen_id;
  if (!leadgenId) return;

  // Страница → проект
  const { data: page } = await admin
    .from("meta_pages")
    .select("project_id")
    .eq("page_id", pageId)
    .maybeSingle();
  if (!page) return;
  const projectId = page.project_id;

  // Уже обработан? (дедупликация по leadgen_id)
  const { data: existing } = await admin
    .from("leads")
    .select("id")
    .eq("external_id", leadgenId)
    .maybeSingle();
  if (existing) return;

  const token = await projectToken(admin, projectId);
  if (!token) return;

  let detail;
  try {
    detail = await fetchLead(leadgenId, token);
  } catch {
    return;
  }

  const { data: inserted } = await admin
    .from("leads")
    .insert({
      project_id: projectId,
      full_name: detail.fullName,
      phone: detail.phone,
      source: "meta",
      status: "new",
      external_id: leadgenId,
      campaign_id: detail.campaignId ?? value.campaign_id ?? null,
      adset_id: detail.adsetId ?? value.adgroup_id ?? null,
      ad_id: detail.adId ?? value.ad_id ?? null,
      form_id: detail.formId ?? value.form_id ?? null,
    })
    .select("id")
    .maybeSingle();
  if (!inserted) return;

  // Раздача хантеру на смене (round-robin) + уведомление в Telegram
  const hunter = await pickNextHunter(admin, projectId);
  if (hunter) await assignLead(admin, projectId, inserted.id, hunter);
}

/** POST — приём заявок с лид-форм Meta. */
export async function POST(req: NextRequest) {
  const raw = await req.text();

  // Проверка подписи (если задан App Secret)
  const secret = process.env.META_APP_SECRET;
  if (secret) {
    const sig = req.headers.get("x-hub-signature-256") ?? "";
    const expected = "sha256=" + crypto.createHmac("sha256", secret).update(raw).digest("hex");
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }
  }

  let body: WebhookBody;
  try {
    body = JSON.parse(raw) as WebhookBody;
  } catch {
    return NextResponse.json({ ok: true });
  }

  const admin = createAdminClient();
  try {
    for (const entry of body.entry ?? []) {
      for (const change of entry.changes ?? []) {
        if (change.field === "leadgen") {
          await handleLeadgen(admin, entry.id, change.value);
        }
      }
    }
  } catch {
    // Никогда не отдаём ошибку Meta — иначе будет ретраить
  }
  return NextResponse.json({ ok: true });
}
