import { getProject } from "@/lib/queries";
import { resolveDateRange } from "@/lib/date-range";
import { DashboardEducation } from "@/components/dashboard-education";
import { DashboardEcommerce } from "@/components/dashboard-ecommerce";

const str = (v: string | string[] | undefined) =>
  typeof v === "string" ? v : undefined;

export default async function Dashboard({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { projectId } = await params;
  const sp = await searchParams;
  const range = resolveDateRange({
    range: str(sp.range),
    from: str(sp.from),
    to: str(sp.to),
  });

  // Авторизация гарантирована middleware + layout; проект кэширован (общий с layout).
  const project = await getProject(projectId);
  if (!project) return null;

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
