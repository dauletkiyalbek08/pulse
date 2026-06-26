import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PortalView } from "@/components/portal-view";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: projects }] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, global_role")
      .eq("id", user.id)
      .single(),
    supabase
      .from("projects")
      .select("*")
      .order("created_at", { ascending: true }),
  ]);

  const isOwner = profile?.global_role === "owner";
  const list = projects ?? [];

  // Сотрудники (не владелец) попадают сразу в свой проект, минуя портал.
  if (!isOwner && list.length === 1) redirect(`/p/${list[0].id}`);

  return (
    <PortalView
      projects={list}
      canCreate={isOwner}
      user={{
        name: profile?.full_name ?? user.email ?? "",
        role: profile?.global_role ?? "director",
        email: user.email ?? "",
      }}
    />
  );
}
