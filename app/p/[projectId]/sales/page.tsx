import { redirect } from "next/navigation";
import { ShoppingCart, Banknote, Receipt } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { MetricCard } from "@/components/metric-card";
import { formatCurrency, formatNumber, formatDate } from "@/lib/format";

export default async function SalesPage({
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

  const { data: sales } = await supabase
    .from("sales")
    .select("id, product, manager_id, amount, created_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  const rows = sales ?? [];

  const managerIds = [
    ...new Set(rows.map((s) => s.manager_id).filter(Boolean)),
  ] as string[];
  const { data: profiles } = managerIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", managerIds)
    : { data: [] };
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

  const total = rows.reduce((s, r) => s + Number(r.amount), 0);
  const avg = rows.length ? total / rows.length : 0;

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <PageHeader title="Продажи" subtitle={`Всего продаж: ${rows.length}`} />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricCard
          label="Продаж"
          value={formatNumber(rows.length)}
          icon={ShoppingCart}
        />
        <MetricCard label="Выручка" value={formatCurrency(total)} icon={Banknote} accent />
        <MetricCard label="Средний чек" value={formatCurrency(avg)} icon={Receipt} />
      </div>

      {rows.length === 0 ? (
        <div className="rounded-card border border-dashed border-line bg-surface px-6 py-16 text-center text-sm text-muted">
          Продаж пока нет.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-card bg-surface shadow-soft ring-1 ring-line">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-faint">
                <th className="px-5 py-3 font-medium">Товар / курс</th>
                <th className="px-5 py-3 font-medium">Менеджер</th>
                <th className="px-5 py-3 text-right font-medium">Сумма</th>
                <th className="px-5 py-3 font-medium">Дата</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((sale) => (
                <tr
                  key={sale.id}
                  className="border-b border-line last:border-0 transition hover:bg-canvas"
                >
                  <td className="px-5 py-3 font-medium text-ink">
                    {sale.product ?? "—"}
                  </td>
                  <td className="px-5 py-3 text-muted">
                    {sale.manager_id ? nameById.get(sale.manager_id) ?? "—" : "—"}
                  </td>
                  <td className="px-5 py-3 text-right font-semibold text-ink">
                    {formatCurrency(Number(sale.amount))}
                  </td>
                  <td className="px-5 py-3 text-muted">
                    {formatDate(sale.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
