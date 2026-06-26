import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DashboardEducation } from "@/components/dashboard-education";
import { DashboardEcommerce } from "@/components/dashboard-ecommerce";

export default async function Dashboard({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: project } = await supabase
    .from("projects")
    .select("id, name, niche")
    .eq("id", projectId)
    .maybeSingle();
  if (!project) return null; // доступ/наличие проверяет layout (notFound)

  return project.niche === "ecommerce" ? (
    <DashboardEcommerce projectId={project.id} projectName={project.name} />
  ) : (
    <DashboardEducation projectId={project.id} projectName={project.name} />
  );
}
