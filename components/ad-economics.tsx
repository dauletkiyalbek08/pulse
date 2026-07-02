import { Megaphone, Users, ShoppingBag, Wallet, TrendingUp } from "lucide-react";

const usd = (n: number, d = 2) => `$${(Math.round(n * 100) / 100).toFixed(d)}`;
const kzt = (n: number) => `${Math.round(n).toLocaleString("ru-RU")} ₸`;

/**
 * Сводка «Итого с рекламы» за 30 дней: расход (по кампаниям Pulse) и реальные
 * лиды/продажи/выручка из CRM. Показывает деньги, даже если продажа не привязана
 * к конкретному креативу.
 */
export function AdEconomics({
  spendUsd,
  leads,
  sales,
  revenueKzt,
  usdRate,
  rangeLabel,
}: {
  spendUsd: number;
  leads: number;
  sales: number;
  revenueKzt: number;
  usdRate: number;
  rangeLabel: string;
}) {
  const spendKzt = spendUsd * usdRate;
  const roas = spendKzt > 0 ? revenueKzt / spendKzt : 0;
  const costPerSaleUsd = sales > 0 ? spendUsd / sales : 0;

  return (
    <div className="rounded-card bg-surface p-5 shadow-soft ring-1 ring-line">
      <div className="mb-3">
        <div className="text-sm font-semibold text-ink">Итого с рекламы · {rangeLabel}</div>
        <div className="text-xs text-muted">
          Расход — по кампаниям Pulse. Лиды и продажи — реальные из CRM (источник: сайт / Meta),
          включая продажи без привязки к конкретному креативу.
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Tile icon={Megaphone} label="Расход" value={usd(spendUsd)} hint={`≈ ${kzt(spendKzt)}`} />
        <Tile icon={Users} label="Лиды с рекламы" value={String(leads)} />
        <Tile icon={ShoppingBag} label="Продажи" value={String(sales)} />
        <Tile icon={Wallet} label="Выручка" value={revenueKzt > 0 ? kzt(revenueKzt) : "—"} tone="brand" />
        <Tile
          icon={TrendingUp}
          label="ROAS · окупаемость"
          value={spendKzt > 0 && sales > 0 ? `${roas.toFixed(1)}×` : "—"}
          hint={sales > 0 ? `цена продажи ${usd(costPerSaleUsd)}` : undefined}
          tone={sales > 0 ? (roas >= 1 ? "brand" : "bad") : "ink"}
        />
      </div>
    </div>
  );
}

function Tile({
  icon: Icon,
  label,
  value,
  hint,
  tone = "ink",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint?: string;
  tone?: "ink" | "brand" | "bad";
}) {
  const color = tone === "brand" ? "text-brand-ink" : tone === "bad" ? "text-red-600" : "text-ink";
  return (
    <div className="rounded-xl border border-line bg-canvas p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted">{label}</span>
        <Icon className="h-3.5 w-3.5 text-faint" />
      </div>
      <div className={`mt-1 text-lg font-bold ${color}`}>{value}</div>
      {hint && <div className="mt-0.5 text-[11px] text-muted">{hint}</div>}
    </div>
  );
}
