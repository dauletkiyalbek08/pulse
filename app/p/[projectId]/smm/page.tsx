import { requireAccess, getEffectiveRole } from "@/lib/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCallAiAvailability } from "@/lib/platform-config";
import { PageHeader } from "@/components/page-header";
import { SmmStudio, type SmmPost, type SmmStats } from "@/components/smm-studio";

export const dynamic = "force-dynamic";

export default async function SmmPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  await requireAccess(projectId, "smm");

  const role = await getEffectiveRole(projectId);
  const isOwner = role === "owner";
  const availability = await getCallAiAvailability(projectId);

  const admin = createAdminClient();
  const [{ data: postsData }, { data: gens }] = await Promise.all([
    admin
      .from("smm_posts")
      .select("id, title, format, rubric, goal, status")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false }),
    admin.from("ai_generations").select("output").eq("project_id", projectId).eq("tool", "smm_ideas"),
  ]);

  const posts: SmmPost[] = (postsData ?? []) as SmmPost[];
  let ideasCount = 0;
  for (const g of gens ?? []) {
    try {
      const arr = JSON.parse(g.output);
      if (Array.isArray(arr)) ideasCount += arr.length;
    } catch {
      /* пропускаем */
    }
  }

  const stats: SmmStats = {
    total: posts.length,
    scheduled: posts.filter((p) => p.status === "scheduled").length,
    published: posts.filter((p) => p.status === "published").length,
    ideas: ideasCount,
  };

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <PageHeader title="SMM Studio" subtitle="Идеи контента и контент-план для соцсетей" />
      <SmmStudio
        projectId={projectId}
        connected={availability.deepseekReady}
        isOwner={isOwner}
        stats={stats}
        posts={posts}
      />
    </div>
  );
}
