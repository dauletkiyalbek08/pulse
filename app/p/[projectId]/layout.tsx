import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProject, getEffectiveRole } from "@/lib/queries";
import { getNiche } from "@/lib/niches";
import { getMenu } from "@/lib/menu";
import { filterMenuByRole } from "@/lib/access";
import { Sidebar } from "@/components/sidebar";
import { ProjectTopbar } from "@/components/project-topbar";

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [project, { data: profile }, role] = await Promise.all([
    getProject(projectId),
    supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .single(),
    getEffectiveRole(projectId),
  ]);

  if (!project) notFound();

  const niche = getNiche(project.niche);
  const sections = filterMenuByRole(getMenu(niche.key), role);

  return (
    <div className="min-h-screen">
      <Sidebar
        projectId={project.id}
        projectName={project.name}
        nicheLabel={niche.label}
        accent={project.accent_color ?? "#10b981"}
        icon={project.icon}
        sections={sections}
      />
      <div className="flex min-h-screen flex-col lg:pl-[260px]">
        <ProjectTopbar
          projectName={project.name}
          user={{
            name: profile?.full_name ?? user.email ?? "",
            role: role ?? "director",
          }}
        />
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
