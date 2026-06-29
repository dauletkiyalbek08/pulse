import { Megaphone } from "lucide-react";
import { requireAccess } from "@/lib/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseQuestions } from "@/lib/quiz-sample";
import { PageHeader } from "@/components/page-header";
import {
  LandingEditor,
  CreateLandingButton,
  CreateQuizButton,
  type Landing,
} from "@/components/landing-editor";

export const dynamic = "force-dynamic";

export default async function ResourcesPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  await requireAccess(projectId, "resources");

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

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <PageHeader title="Ресурсы / Воронки" subtitle="Лендинги и квизы под таргет — заявки сразу в CRM и хантеру">
        <div className="flex flex-wrap gap-2">
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
        <div className="space-y-4">
          {landings.map((l) => (
            <LandingEditor key={l.id} projectId={projectId} landing={l} />
          ))}
        </div>
      )}
    </div>
  );
}
