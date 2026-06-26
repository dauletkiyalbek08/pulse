import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getNiche } from "@/lib/niches";
import { getMenu } from "@/lib/menu";
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

  const [{ data: project }, { data: profile }] = await Promise.all([
    supabase
      .from("projects")
      .select("id, name, niche, icon, accent_color")
      .eq("id", projectId)
      .maybeSingle(),
    supabase
      .from("profiles")
      .select("full_name, global_role")
      .eq("id", user.id)
      .single(),
  ]);

  if (!project) notFound();

  const niche = getNiche(project.niche);
  const sections = getMenu(niche.key);

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
            role: profile?.global_role ?? "director",
          }}
        />
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
