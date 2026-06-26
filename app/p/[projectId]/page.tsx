import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveDateRange } from "@/lib/date-range";
import { DashboardEducation } from "@/components/dashboard-education";
import { DashboardEcommerce } from "@/components/dashboard-ecommerce";

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

const str = (v: string | string[] | undefined) =>
  typeof v === "string" ? v : undefined;

export default async function Dashboard({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: SearchParams;
}) {
  const { projectId } = await params;
  const sp = await searchParams;
  const range = resolveDateRange({
    range: str(sp.range),
    from: str(sp.from),
    to: str(sp.to),
  });

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
    <DashboardEcommerce
      projectId={project.id}
      projectName={project.name}
      range={range}
    />
  ) : (
    <DashboardEducation
      projectId={project.id}
      projectName={project.name}
      range={range}
    />
  );
}
