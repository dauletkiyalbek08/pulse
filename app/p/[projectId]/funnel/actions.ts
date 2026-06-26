"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function updateLeadStatus(
  projectId: string,
  leadId: string,
  status: string,
): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("leads")
    .update({ status })
    .eq("id", leadId)
    .eq("project_id", projectId);
  if (error) return { ok: false };
  revalidatePath(`/p/${projectId}/funnel`);
  revalidatePath(`/p/${projectId}/leads`);
  return { ok: true };
}

export interface LeadNote {
  id: string;
  text: string;
  created_at: string;
  author: string;
}

export async function getLeadNotes(leadId: string): Promise<LeadNote[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("lead_notes")
    .select("id, text, created_at, author_id")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false });

  const ids = [...new Set((data ?? []).map((n) => n.author_id).filter(Boolean))] as string[];
  const { data: profs } = ids.length
    ? await supabase.from("profiles").select("id, full_name").in("id", ids)
    : { data: [] };
  const nameById = new Map((profs ?? []).map((p) => [p.id, p.full_name]));

  return (data ?? []).map((n) => ({
    id: n.id,
    text: n.text,
    created_at: n.created_at,
    author: n.author_id ? nameById.get(n.author_id) ?? "—" : "—",
  }));
}

export async function addLeadNote(
  projectId: string,
  leadId: string,
  text: string,
): Promise<{ ok: boolean }> {
  const t = text.trim();
  if (!t) return { ok: false };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase.from("lead_notes").insert({
    project_id: projectId,
    lead_id: leadId,
    author_id: user?.id ?? null,
    text: t,
  });
  return { ok: !error };
}
