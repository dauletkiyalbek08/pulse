import { redirect } from "next/navigation";
import { Users, Banknote, TrendingUp } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { MetricCard } from "@/components/metric-card";
import { formatCurrency, formatNumber, formatDate } from "@/lib/format";

export default async function ClientsPage({
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

  const { data: customers } = await supabase
    .from("customers")
    .select("*")
    .eq("project_id", projectId)
    .order("total_spent", { ascending: false });
  const rows = customers ?? [];

  const { data: sales } = await supabase
    .from("sales")
    .select("customer_id, product, amount")
    .eq("project_id", projectId)
    .not("customer_id", "is", null);

  // Покупки по клиенту
  const purchases = new Map<string, { product: string | null; amount: number }[]>();
  (sales ?? []).forEach((s) => {
    if (!s.customer_id) return;
    const list = purchases.get(s.customer_id) ?? [];
    list.push({ product: s.product, amount: Number(s.amount) });
    purchases.set(s.customer_id, list);
  });

  const totalLtv = rows.reduce((sum, c) => sum + Number(c.total_spent), 0);
  const avgLtv = rows.length ? totalLtv / rows.length : 0;

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <PageHeader title="Клиенты" subtitle={`Покупателей: ${rows.length}`} />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricCard label="Клиентов" value={formatNumber(rows.length)} icon={Users} />
        <MetricCard label="Суммарный LTV" value={formatCurrency(totalLtv)} icon={Banknote} accent />
        <MetricCard label="Средний LTV" value={formatCurrency(avgLtv)} icon={TrendingUp} />
      </div>

      {rows.length === 0 ? (
        <div className="rounded-card border border-dashed border-line bg-surface px-6 py-16 text-center text-sm text-muted">
          Клиентов пока нет — они появляются после первой продажи.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-card bg-surface shadow-soft ring-1 ring-line">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-faint">
                <th className="px-5 py-3 font-medium">Клиент</th>
                <th className="px-5 py-3 font-medium">Телефон</th>
                <th className="px-5 py-3 font-medium">Покупки</th>
                <th className="px-5 py-3 text-right font-medium">Кол-во</th>
                <th className="px-5 py-3 text-right font-medium">LTV</th>
                <th className="px-5 py-3 font-medium">Первая покупка</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((customer) => {
                const list = purchases.get(customer.id) ?? [];
                const products = list
                  .map((p) => p.product)
                  .filter(Boolean)
                  .join(", ");
                return (
                  <tr
                    key={customer.id}
                    className="border-b border-line last:border-0 transition hover:bg-canvas"
                  >
                    <td className="px-5 py-3 font-medium text-ink">{customer.full_name}</td>
                    <td className="px-5 py-3 text-muted">{customer.phone ?? "—"}</td>
                    <td className="px-5 py-3 text-muted">
                      <span className="line-clamp-1 max-w-[280px]">{products || "—"}</span>
                    </td>
                    <td className="px-5 py-3 text-right text-ink">{list.length}</td>
                    <td className="px-5 py-3 text-right font-semibold text-brand-ink">
                      {formatCurrency(Number(customer.total_spent))}
                    </td>
                    <td className="px-5 py-3 text-muted">
                      {customer.first_purchase_at ? formatDate(customer.first_purchase_at) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
