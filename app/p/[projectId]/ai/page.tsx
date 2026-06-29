import { requireAccess, getEffectiveRole } from "@/lib/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCallAiAvailability } from "@/lib/platform-config";
import { PageHeader } from "@/components/page-header";
import { AiStudio, type GenerationRow } from "@/components/ai-studio";

export const dynamic = "force-dynamic";

export default async function AiStudioPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  await requireAccess(projectId, "ai");

  const role = await getEffectiveRole(projectId);
  const isOwner = role === "owner";
  const availability = await getCallAiAvailability(projectId);

  const admin = createAdminClient();
  const { data } = await admin
    .from("ai_generations")
    .select("id, tool, title, output, created_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(20);
  const recent: GenerationRow[] = (data ?? []) as GenerationRow[];

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <PageHeader title="AI Studio" subtitle="Генерация рекламных текстов и идей через ИИ (DeepSeek)" />
      <AiStudio
        projectId={projectId}
        connected={availability.deepseekReady}
        isOwner={isOwner}
        recent={recent}
      />
    </div>
  );
}
