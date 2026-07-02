import { Megaphone } from "lucide-react";
import { requireAccess } from "@/lib/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseQuestions } from "@/lib/quiz-sample";
import { getLandingFunnel, type LandingFunnel } from "@/lib/landing-funnel";
import { rangeFromSearchParams } from "@/lib/date-range";
import { PageHeader } from "@/components/page-header";
import { DateRangePicker } from "@/components/date-range-picker";
import { LandingFunnelView } from "@/components/landing-funnel";
import {
  LandingEditor,
  CreateLandingButton,
  CreateQuizButton,
  type Landing,
} from "@/components/landing-editor";

export const dynamic = "force-dynamic";

export default async function ResourcesPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { projectId } = await params;
  await requireAccess(projectId, "resources");

  const range = rangeFromSearchParams(await searchParams);
  const admin = createAdminClient();
  const { data } = await admin
    .from("landings")
    .select(
      "id, slug, title, subtitle, bullets, button_text, thanks_text, accent, pixel_id, status, type, questions, logo, socials, start_button",
    )
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  const landings: Landing[] = (data ?? []).map((l) => ({
    id: l.id,
    slug: l.slug,
    title: l.title,
    subtitle: l.subtitle,
    bullets: Array.isArray(l.bullets) ? (l.bullets as string[]) : [],
    button_text: l.button_text,
    thanks_text: l.thanks_text,
    accent: l.accent,
    pixel_id: l.pixel_id,
    status: l.status,
    type: l.type,
    questions: parseQuestions(l.questions),
    logo: l.logo,
    socials: l.socials && typeof l.socials === "object" ? (l.socials as Landing["socials"]) : {},
    start_button: l.start_button,
  }));

  // Воронка по каждому лендингу (из landing_sessions за 30 дней).
  const funnels: Record<string, LandingFunnel> = {};
  await Promise.all(
    landings.map(async (l) => {
      funnels[l.id] = await getLandingFunnel(
        admin,
        { id: l.id, type: l.type, questionCount: l.questions.length },
        range,
      );
    }),
  );

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <PageHeader title="Ресурсы / Воронки" subtitle="Лендинги и квизы под таргет — заявки сразу в CRM и хантеру">
        <div className="flex flex-wrap items-center gap-2">
          <DateRangePicker preset={range.preset} from={range.from} to={range.to} label={range.label} />
          <CreateQuizButton projectId={projectId} />
          <CreateLandingButton projectId={projectId} />
        </div>
      </PageHeader>

      <div className="mb-6 flex items-start gap-3 rounded-card border border-brand-soft bg-brand-soft/40 p-4">
        <Megaphone className="mt-0.5 h-5 w-5 shrink-0 text-brand-ink" />
        <p className="text-sm text-ink">
          <span className="font-medium">Квиз</span> — пошаговый опрос (как на Tilda), <span className="font-medium">лендинг</span> —
          один экран с формой. Ставишь ссылку в рекламу → заявки падают в «Лиды» и раздаются хантерам
          по очереди (ответы квиза сохраняются в лиде). Укажи Pixel ID — события уйдут в Meta, и Purchase
          по продаже отправится автоматически. Tilda не нужна.
        </p>
      </div>

      {landings.length === 0 ? (
        <div className="rounded-card border border-dashed border-line bg-surface px-6 py-12 text-center text-sm text-muted">
          Пока пусто. «Создать квиз» — готовый пример (диагностика английского) на казахском, который
          останется отредактировать под себя.
        </div>
      ) : (
        <div className="space-y-8">
          {landings.map((l) => (
            <div key={l.id} className="space-y-3">
              <LandingEditor projectId={projectId} landing={l} />
              <LandingFunnelView funnel={funnels[l.id]} rangeLabel={range.label} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
