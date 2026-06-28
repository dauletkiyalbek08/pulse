import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatNumber } from "@/lib/format";
import { PlatformAiSettings } from "@/components/platform-ai-settings";
import { getPlatformAiSettings, getPlatformUsage } from "./actions";

export const dynamic = "force-dynamic";

const fmtUsd = (n: number) =>
  `$${n.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default async function PlatformSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("global_role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.global_role !== "owner") redirect("/");

  const [settings, usage] = await Promise.all([getPlatformAiSettings(), getPlatformUsage()]);
  const totalUsd = usage.reduce((s, u) => s + u.estUsd, 0);
  const monthName = new Date().toLocaleString("ru-RU", { month: "long", year: "numeric" });

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-line bg-surface/80 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-6 py-3.5">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-muted transition hover:text-ink"
          >
            <ArrowLeft className="h-4 w-4" /> Мои проекты
          </Link>
          <span className="text-sm font-semibold text-ink">· Настройки платформы</span>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-10">
        <h1 className="text-2xl font-bold tracking-tight text-ink">Настройки платформы</h1>
        <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-muted">
          Ключи ИИ для анализа звонков — <span className="font-medium text-ink">один набор на все проекты</span>.
          Подключаешь здесь — работает во всех проектах сразу. Хранятся зашифрованно на сервере и не
          попадают в браузер.
        </p>

        <section className="mt-8">
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-brand" />
            <h2 className="text-base font-semibold text-ink">Ключи ИИ (анализ звонков)</h2>
          </div>
          <PlatformAiSettings settings={settings} />
        </section>

        <section className="mt-10">
          <h2 className="text-base font-semibold text-ink">Расход по проектам · {monthName}</h2>
          <p className="mt-1 text-sm text-muted">
            Сколько звонков разобрано и примерная стоимость (распознавание + анализ). Оценка
            ориентировочная.
          </p>

          {usage.length === 0 ? (
            <div className="mt-4 rounded-card border border-dashed border-line bg-surface px-6 py-10 text-center text-sm text-muted">
              В этом месяце разборов ещё не было.
            </div>
          ) : (
            <div className="mt-4 overflow-hidden rounded-card bg-surface shadow-soft ring-1 ring-line">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs text-muted">
                    <th className="px-4 py-3 font-medium">Проект</th>
                    <th className="px-4 py-3 text-right font-medium">Разборов</th>
                    <th className="px-4 py-3 text-right font-medium">Минут аудио</th>
                    <th className="px-4 py-3 text-right font-medium">Примерно, $</th>
                  </tr>
                </thead>
                <tbody>
                  {usage.map((u) => (
                    <tr key={u.projectId} className="border-b border-line last:border-0">
                      <td className="px-4 py-3 font-medium text-ink">{u.name}</td>
                      <td className="px-4 py-3 text-right text-ink">{formatNumber(u.calls)}</td>
                      <td className="px-4 py-3 text-right text-muted">
                        {u.audioMinutes > 0 ? formatNumber(Math.round(u.audioMinutes)) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right text-ink">{fmtUsd(u.estUsd)}</td>
                    </tr>
                  ))}
                  <tr className="bg-canvas/50 font-semibold">
                    <td className="px-4 py-3 text-ink">Итого</td>
                    <td className="px-4 py-3 text-right text-ink">
                      {formatNumber(usage.reduce((s, u) => s + u.calls, 0))}
                    </td>
                    <td className="px-4 py-3 text-right text-muted">
                      {formatNumber(Math.round(usage.reduce((s, u) => s + u.audioMinutes, 0)))}
                    </td>
                    <td className="px-4 py-3 text-right text-ink">{fmtUsd(totalUsd)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
