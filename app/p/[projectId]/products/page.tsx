import { Boxes, Package, AlertTriangle, Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { MetricCard } from "@/components/metric-card";
import { Pill } from "@/components/pill";
import { formatCurrency, formatNumber } from "@/lib/format";

export default async function ProductsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  const supabase = await createClient();

  const { data: products } = await supabase
    .from("products")
    .select("*")
    .eq("project_id", projectId)
    .order("name", { ascending: true });
  const rows = products ?? [];

  const catalogCount = rows.length;
  const totalUnits = rows.reduce((s, p) => s + p.stock_quantity, 0);
  const lowStock = rows.filter((p) => p.stock_quantity <= p.low_stock_threshold);
  const stockCost = rows.reduce(
    (s, p) => s + p.stock_quantity * Number(p.cost_price),
    0,
  );

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <PageHeader title="Товары (склад)" subtitle={`Позиций в каталоге: ${catalogCount}`} />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard label="Товаров в каталоге" value={formatNumber(catalogCount)} icon={Boxes} />
        <MetricCard label="Единиц на складе" value={formatNumber(totalUnits)} icon={Package} />
        <MetricCard label="Заканчиваются" value={formatNumber(lowStock.length)} icon={AlertTriangle} />
        <MetricCard label="Себестоимость склада" value={formatCurrency(stockCost)} icon={Wallet} />
      </div>

      {rows.length === 0 ? (
        <div className="rounded-card border border-dashed border-line bg-surface px-6 py-16 text-center text-sm text-muted">
          Товаров пока нет.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-card bg-surface shadow-soft ring-1 ring-line">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-faint">
                <th className="px-5 py-3 font-medium">Товар</th>
                <th className="px-5 py-3 font-medium">SKU</th>
                <th className="px-5 py-3 text-right font-medium">На складе</th>
                <th className="px-5 py-3 text-right font-medium">Себестоимость</th>
                <th className="px-5 py-3 text-right font-medium">Цена продажи</th>
                <th className="px-5 py-3 text-right font-medium">Маржа</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((product) => {
                const low = product.stock_quantity <= product.low_stock_threshold;
                const margin = Number(product.sale_price) - Number(product.cost_price);
                return (
                  <tr
                    key={product.id}
                    className="border-b border-line last:border-0 transition hover:bg-canvas"
                  >
                    <td className="px-5 py-3 font-medium text-ink">{product.name}</td>
                    <td className="px-5 py-3 text-muted">{product.sku ?? "—"}</td>
                    <td className="px-5 py-3 text-right">
                      <span className="inline-flex items-center gap-2">
                        <span className="text-ink">{formatNumber(product.stock_quantity)}</span>
                        {low && <Pill tone="warning">заканчивается</Pill>}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right text-muted">
                      {formatCurrency(Number(product.cost_price))}
                    </td>
                    <td className="px-5 py-3 text-right text-ink">
                      {formatCurrency(Number(product.sale_price))}
                    </td>
                    <td className="px-5 py-3 text-right font-semibold text-brand-ink">
                      {formatCurrency(margin)}
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
