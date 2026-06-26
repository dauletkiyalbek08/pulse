import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { NewProjectForm } from "@/components/new-project-form";

export default async function NewProjectPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-surface/80 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center px-6 py-3.5">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted transition hover:text-ink"
          >
            <ArrowLeft className="h-4 w-4" />
            Мои проекты
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-6 py-10 sm:py-14">
        <h1 className="text-3xl font-bold tracking-tight text-ink">
          Новый проект
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-muted">
          Выберите нишу и заполните основные данные. Раздел, метрики и воронка
          подстроятся под нишу автоматически.
        </p>

        <div className="mt-8">
          <NewProjectForm />
        </div>
      </main>
    </div>
  );
}
