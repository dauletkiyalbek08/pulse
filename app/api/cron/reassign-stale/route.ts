import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { reassignLead, REASSIGN_AFTER_MIN } from "@/lib/lead-dispatch";

/**
 * Передаёт непринятые лиды другому хантеру, если прошло больше REASSIGN_AFTER_MIN.
 * Дёргается внешним планировщиком (cron-job.org) с ?key=<TELEGRAM_WEBHOOK_SECRET>.
 */
export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("key") !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const admin = createAdminClient();
  const cutoff = new Date(Date.now() - REASSIGN_AFTER_MIN * 60_000).toISOString();

  const { data: stale } = await admin
    .from("leads")
    .select("id, project_id, assigned_to")
    .not("assigned_to", "is", null)
    .is("accepted_at", null)
    .lt("assigned_at", cutoff);

  let moved = 0;
  for (const l of stale ?? []) {
    if (l.assigned_to && (await reassignLead(admin, l.project_id, l.id, l.assigned_to))) {
      moved++;
    }
  }

  return NextResponse.json({ ok: true, checked: stale?.length ?? 0, moved });
}
