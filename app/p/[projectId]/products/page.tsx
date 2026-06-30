import { Boxes, Package, AlertTriangle, Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireAccess } from "@/lib/queries";
import { PageHeader } from "@/components/page-header";
import { MetricCard } from "@/components/metric-card";
import { ProductsManager, type ProductRow } from "@/components/products-manager";
import { formatCurrency, formatNumber } from "@/lib/format";

export default async function ProductsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  await requireAccess(projectId, "products");

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

  const items: ProductRow[] = rows.map((p) => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
    stock_quantity: p.stock_quantity,
    cost_price: Number(p.cost_price),
    sale_price: Number(p.sale_price),
    low_stock_threshold: p.low_stock_threshold,
  }));

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <PageHeader title="Товары (склад)" subtitle={`Позиций в каталоге: ${catalogCount}`} />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard label="Товаров в каталоге" value={formatNumber(catalogCount)} icon={Boxes} />
        <MetricCard label="Единиц на складе" value={formatNumber(totalUnits)} icon={Package} />
        <MetricCard label="Заканчиваются" value={formatNumber(lowStock.length)} icon={AlertTriangle} />
        <MetricCard label="Себестоимость склада" value={formatCurrency(stockCost)} icon={Wallet} />
      </div>

      <ProductsManager projectId={projectId} products={items} />
    </div>
  );
}
