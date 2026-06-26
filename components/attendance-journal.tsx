"use client";

import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { Pill } from "@/components/pill";
import { roleLabel } from "@/lib/members";

export interface JournalRow {
  id: string;
  name: string;
  role: string;
  date: string;
  checkIn: string;
  checkOut: string;
  status: "on_time" | "late" | "open";
  distanceM: number | null;
}

const STATUS_META: Record<JournalRow["status"], { label: string; tone: "success" | "warning" | "info" }> = {
  on_time: { label: "Вовремя", tone: "success" },
  late: { label: "Опоздал", tone: "warning" },
  open: { label: "На смене", tone: "info" },
};

export function AttendanceJournal({ rows }: { rows: JournalRow[] }) {
  const [status, setStatus] = useState("");

  const filtered = useMemo(
    () => (status ? rows.filter((r) => r.status === status) : rows),
    [rows, status],
  );

  function exportCsv() {
    const header = ["Сотрудник", "Роль", "Дата", "Приход", "Уход", "Статус", "Комментарий"];
    const lines = filtered.map((r) =>
      [
        r.name,
        roleLabel(r.role),
        r.date,
        r.checkIn,
        r.checkOut,
        STATUS_META[r.status].label,
        r.distanceM != null ? `в офисе · ${Math.round(r.distanceM)} м` : "",
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(","),
    );
    const csv = "﻿" + [header.join(","), ...lines].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `attendance_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-ink">Журнал посещаемости</h2>
        <div className="flex items-center gap-2">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none"
          >
            <option value="">Все статусы</option>
            <option value="on_time">Вовремя</option>
            <option value="late">Опоздал</option>
            <option value="open">На смене</option>
          </select>
          <button
            type="button"
            onClick={exportCsv}
            className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3.5 py-2 text-sm font-medium text-ink transition hover:bg-canvas"
          >
            <Download className="h-4 w-4" />
            Экспорт
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-card border border-dashed border-line bg-surface px-6 py-12 text-center text-sm text-muted">
          Записей нет.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-card bg-surface shadow-soft ring-1 ring-line">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-faint">
                <th className="px-5 py-3 font-medium">Сотрудник</th>
                <th className="px-5 py-3 font-medium">Дата</th>
                <th className="px-5 py-3 font-medium">Приход</th>
                <th className="px-5 py-3 font-medium">Уход</th>
                <th className="px-5 py-3 font-medium">Статус</th>
                <th className="px-5 py-3 font-medium">Комментарий</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const meta = STATUS_META[r.status];
                return (
                  <tr key={r.id} className="border-b border-line last:border-0 transition hover:bg-canvas">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={r.name} size="sm" />
                        <div className="min-w-0">
                          <div className="truncate font-medium text-ink">{r.name}</div>
                          <div className="text-xs text-muted">{roleLabel(r.role)}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-muted">{r.date}</td>
                    <td className="px-5 py-3 text-ink">{r.checkIn}</td>
                    <td className="px-5 py-3 text-muted">{r.checkOut}</td>
                    <td className="px-5 py-3">
                      <Pill tone={meta.tone}>{meta.label}</Pill>
                    </td>
                    <td className="px-5 py-3 text-muted">
                      {r.distanceM != null ? `📍 в офисе · ${Math.round(r.distanceM)} м` : "—"}
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
