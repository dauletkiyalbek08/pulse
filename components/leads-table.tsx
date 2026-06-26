"use client";

import { useMemo, useState } from "react";
import { Search, RotateCcw } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { Pill } from "@/components/pill";
import { getLeadStatusMeta, leadStatusOrder, sourceLabel } from "@/lib/leads";
import type { Niche } from "@/lib/niches";
import { formatCurrency, formatDateTime } from "@/lib/format";

export interface LeadRow {
  id: string;
  full_name: string;
  phone: string | null;
  source: string | null;
  status: string;
  value: number | null;
  created_at: string;
  assigneeName: string | null;
}

const selectClass =
  "rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm text-ink focus:border-brand focus:outline-none";

export function LeadsTable({ rows, niche }: { rows: LeadRow[]; niche: Niche }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [source, setSource] = useState("");

  const sources = useMemo(
    () => [...new Set(rows.map((r) => r.source).filter(Boolean))] as string[],
    [rows],
  );
  const statuses = leadStatusOrder(niche);

  const filtered = rows.filter((r) => {
    if (query) {
      const s = query.toLowerCase();
      if (!r.full_name.toLowerCase().includes(s) && !(r.phone ?? "").toLowerCase().includes(s))
        return false;
    }
    if (status && r.status !== status) return false;
    if (source && r.source !== source) return false;
    return true;
  });

  const reset = () => {
    setQuery("");
    setStatus("");
    setSource("");
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-card bg-surface p-3 shadow-soft ring-1 ring-line lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Имя или телефон..."
            className="w-full rounded-xl border border-line bg-canvas py-2.5 pl-10 pr-3 text-sm text-ink placeholder:text-faint focus:border-brand focus:outline-none"
          />
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={selectClass}>
          <option value="">Все статусы</option>
          {statuses.map((s) => (
            <option key={s} value={s}>
              {getLeadStatusMeta(niche, s).label}
            </option>
          ))}
        </select>
        <select value={source} onChange={(e) => setSource(e.target.value)} className={selectClass}>
          <option value="">Все источники</option>
          {sources.map((s) => (
            <option key={s} value={s}>
              {sourceLabel(s)}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-line px-3.5 py-2.5 text-sm font-medium text-muted transition hover:bg-canvas hover:text-ink"
        >
          <RotateCcw className="h-4 w-4" />
          Сбросить
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-card border border-dashed border-line bg-surface px-6 py-16 text-center text-sm text-muted">
          Лиды не найдены.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-card bg-surface shadow-soft ring-1 ring-line">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-faint">
                <th className="px-5 py-3 font-medium">Клиент</th>
                <th className="px-5 py-3 font-medium">Телефон</th>
                <th className="px-5 py-3 font-medium">Источник</th>
                <th className="px-5 py-3 font-medium">Ответственный</th>
                <th className="px-5 py-3 font-medium">Статус</th>
                <th className="px-5 py-3 text-right font-medium">Сумма</th>
                <th className="px-5 py-3 font-medium">Пришёл</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((lead) => {
                const meta = getLeadStatusMeta(niche, lead.status);
                return (
                  <tr
                    key={lead.id}
                    className="border-b border-line last:border-0 transition hover:bg-canvas"
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={lead.full_name} />
                        <span className="font-medium text-ink">{lead.full_name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-muted">{lead.phone ?? "—"}</td>
                    <td className="px-5 py-3 text-muted">{sourceLabel(lead.source)}</td>
                    <td className="px-5 py-3">
                      {lead.assigneeName ? (
                        <div className="flex items-center gap-2">
                          <Avatar name={lead.assigneeName} size="sm" />
                          <span className="text-muted">{lead.assigneeName}</span>
                        </div>
                      ) : (
                        <span className="text-faint">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <Pill tone={meta.tone}>{meta.label}</Pill>
                    </td>
                    <td className="px-5 py-3 text-right text-ink">
                      {lead.value && Number(lead.value) > 0
                        ? formatCurrency(Number(lead.value))
                        : "—"}
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap text-muted">
                      {formatDateTime(lead.created_at)}
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
