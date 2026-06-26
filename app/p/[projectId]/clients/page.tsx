import { Users, Banknote, TrendingUp, ShoppingBag } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { rangeFromSearchParams, rangeEndExclusive } from "@/lib/date-range";
import { PageHeader } from "@/components/page-header";
import { DateRangePicker } from "@/components/date-range-picker";
import { MetricCard } from "@/components/metric-card";
import { ClientsTable, type ClientRow } from "@/components/clients-table";
import { formatCurrency, formatNumber } from "@/lib/format";

export default async function ClientsPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { projectId } = await params;
  const range = rangeFromSearchParams(await searchParams);

  const supabase = await createClient();

  const { data: customers } = await supabase
    .from("customers")
    .select("*")
    .eq("project_id", projectId)
    .gte("first_purchase_at", range.from)
    .lt("first_purchase_at", rangeEndExclusive(range))
    .order("total_spent", { ascending: false });
  const list = customers ?? [];

  const { data: sales } = await supabase
    .from("sales")
    .select("customer_id, product, amount")
    .eq("project_id", projectId)
    .not("customer_id", "is", null);

  const purchases = new Map<string, { product: string | null }[]>();
  (sales ?? []).forEach((s) => {
    if (!s.customer_id) return;
    const arr = purchases.get(s.customer_id) ?? [];
    arr.push({ product: s.product });
    purchases.set(s.customer_id, arr);
  });

  const rows: ClientRow[] = list.map((c) => {
    const items = purchases.get(c.id) ?? [];
    return {
      id: c.id,
      full_name: c.full_name,
      phone: c.phone,
      total_spent: Number(c.total_spent),
      first_purchase_at: c.first_purchase_at,
      products: items.map((p) => p.product).filter(Boolean).join(", "),
      purchaseCount: items.length,
    };
  });

  const totalLtv = rows.reduce((s, c) => s + c.total_spent, 0);
  const avgLtv = rows.length ? totalLtv / rows.length : 0;
  const totalPurchases = rows.reduce((s, c) => s + c.purchaseCount, 0);

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <PageHeader
        title="Клиенты"
        subtitle={`Новые клиенты за период: ${range.label} · ${rows.length}`}
      >
        <DateRangePicker
          preset={range.preset}
          from={range.from}
          to={range.to}
          label={range.label}
        />
      </PageHeader>

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard label="Всего клиентов" value={formatNumber(rows.length)} icon={Users} />
        <MetricCard label="Покупок" value={formatNumber(totalPurchases)} icon={ShoppingBag} />
        <MetricCard label="Суммарный LTV" value={formatCurrency(totalLtv)} icon={Banknote} accent />
        <MetricCard label="Средний LTV" value={formatCurrency(avgLtv)} icon={TrendingUp} />
      </div>

      {rows.length === 0 ? (
        <div className="rounded-card border border-dashed border-line bg-surface px-6 py-16 text-center text-sm text-muted">
          За выбранный период новых клиентов нет.
        </div>
      ) : (
        <ClientsTable rows={rows} />
      )}
    </div>
  );
}
