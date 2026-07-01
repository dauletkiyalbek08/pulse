import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendMessage } from "@/lib/telegram";
import { buildReport, cronPeriod, almatyYmd, type Frequency, type ReportKind } from "@/lib/reports-tg";

export const dynamic = "force-dynamic";

/**
 * Ежедневный запуск (Vercel Cron, 04:00 UTC = 09:00 Алматы).
 * Отправляет автоотчёты в чаты по расписанию: daily — каждый день,
 * weekly — по понедельникам, monthly — 1-го числа (см. cronPeriod).
 * Защита: Vercel добавляет Authorization: Bearer $CRON_SECRET.
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const admin = createAdminClient();
  const nowYmd = almatyYmd();

  const { data: targets } = await admin
    .from("report_targets")
    .select("project_id, chat_id, kind, frequency")
    .eq("enabled", true);

  let sent = 0;
  for (const t of targets ?? []) {
    const period = cronPeriod(t.frequency as Frequency, nowYmd);
    if (!period) continue; // сегодня для этой частоты отправка не нужна
    try {
      const text = await buildReport(admin, t.project_id, t.kind as ReportKind, period);
      await sendMessage(t.chat_id, text);
      sent++;
    } catch {
      // сбойный чат не должен ронять остальные
    }
  }
  return NextResponse.json({ ok: true, sent });
}
