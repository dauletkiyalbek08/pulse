"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { formatCurrency, formatDate } from "@/lib/format";

export interface ClientRow {
  id: string;
  full_name: string;
  phone: string | null;
  total_spent: number;
  first_purchase_at: string | null;
  products: string;
  purchaseCount: number;
}

export function ClientsTable({ rows }: { rows: ClientRow[] }) {
  const [query, setQuery] = useState("");
  const s = query.trim().toLowerCase();
  const filtered = s
    ? rows.filter(
        (r) =>
          r.full_name.toLowerCase().includes(s) ||
          (r.phone ?? "").toLowerCase().includes(s),
      )
    : rows;

  return (
    <div className="space-y-4">
      <div className="rounded-card bg-surface p-3 shadow-soft ring-1 ring-line">
        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Имя или телефон..."
            className="w-full rounded-xl border border-line bg-canvas py-2.5 pl-10 pr-3 text-sm text-ink placeholder:text-faint focus:border-brand focus:outline-none"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-card border border-dashed border-line bg-surface px-6 py-16 text-center text-sm text-muted">
          Клиенты не найдены.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-card bg-surface shadow-soft ring-1 ring-line">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-faint">
                <th className="px-5 py-3 font-medium">Клиент</th>
                <th className="px-5 py-3 font-medium">Покупки</th>
                <th className="px-5 py-3 text-right font-medium">Кол-во</th>
                <th className="px-5 py-3 text-right font-medium">LTV</th>
                <th className="px-5 py-3 font-medium">Первая покупка</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr
                  key={c.id}
                  className="border-b border-line last:border-0 transition hover:bg-canvas"
                >
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={c.full_name} />
                      <div>
                        <div className="font-medium text-ink">{c.full_name}</div>
                        <div className="text-xs text-muted">{c.phone ?? "—"}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-muted">
                    <span className="line-clamp-1 max-w-[300px]">{c.products || "—"}</span>
                  </td>
                  <td className="px-5 py-3 text-right text-ink">{c.purchaseCount}</td>
                  <td className="px-5 py-3 text-right font-semibold text-brand-ink">
                    {formatCurrency(c.total_spent)}
                  </td>
                  <td className="px-5 py-3 text-muted">
                    {c.first_purchase_at ? formatDate(c.first_purchase_at) : "—"}
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
