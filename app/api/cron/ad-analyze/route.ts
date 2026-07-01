import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runAdAnalysis } from "@/lib/ad-analyze";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Ежедневный авто-анализ авто-кампаний (Vercel Cron).
 * Считает CPL по каждой активной кампании и шлёт в бот советы с кнопками
 * (поднять бюджет / остановить). Ничего не меняет само.
 * Защита: Vercel добавляет Authorization: Bearer $CRON_SECRET.
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const admin = createAdminClient();
  const res = await runAdAnalysis(admin);
  return NextResponse.json({ ok: true, ...res });
}
