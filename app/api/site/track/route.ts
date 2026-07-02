import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Трекинг воронки лендинга/квиза (без персональных данных).
 * URL: /api/site/track?t=<project.site_token>
 * Body: { landing: <landing_id>, session: <клиентский id>, step: number, submitted?: boolean }
 * Пишем одну строку на сессию (максимальный шаг + флаг отправки) через RPC.
 */
export async function POST(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("t");
  if (!token) return NextResponse.json({ ok: true });

  let body: { landing?: string; session?: string; step?: number; submitted?: boolean };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: true });
  }

  const landingId = typeof body.landing === "string" ? body.landing : "";
  const session = typeof body.session === "string" ? body.session.slice(0, 64) : "";
  const step = Number.isFinite(body.step) ? Math.max(0, Math.min(99, Math.trunc(body.step as number))) : 0;
  const submitted = body.submitted === true;
  if (!landingId || !session) return NextResponse.json({ ok: true });

  const admin = createAdminClient();

  // Токен → проект; лендинг должен принадлежать этому проекту.
  const { data: project } = await admin.from("projects").select("id").eq("site_token", token).maybeSingle();
  if (!project) return NextResponse.json({ ok: true });

  const { data: landing } = await admin
    .from("landings")
    .select("id")
    .eq("id", landingId)
    .eq("project_id", project.id)
    .maybeSingle();
  if (!landing) return NextResponse.json({ ok: true });

  try {
    await admin.rpc("track_landing_session", {
      p_project: project.id,
      p_landing: landing.id,
      p_session: session,
      p_step: step,
      p_submitted: submitted,
    });
  } catch {
    // аналитика не критична — молча игнорируем сбой
  }

  return NextResponse.json({ ok: true });
}
