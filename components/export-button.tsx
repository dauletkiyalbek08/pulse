"use client";

import { Download } from "lucide-react";

/** Экранирование ячейки для CSV (разделитель «;»). */
function cell(v: string | number): string {
  const s = String(v ?? "");
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Кнопка «Скачать» — формирует CSV из готовых строк и сохраняет файл.
 * UTF-8 BOM + «;» — корректно открывается в Excel (в т.ч. кириллица).
 */
export function ExportButton({
  filename,
  headers,
  rows,
  label = "Скачать",
}: {
  filename: string;
  headers: string[];
  rows: (string | number)[][];
  label?: string;
}) {
  function download() {
    const lines = [headers, ...rows].map((r) => r.map(cell).join(";"));
    const csv = "﻿" + lines.join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <button
      type="button"
      onClick={download}
      disabled={rows.length === 0}
      className="inline-flex items-center gap-2 rounded-xl border border-line bg-surface px-3.5 py-2 text-sm font-medium text-ink shadow-soft transition hover:bg-canvas disabled:opacity-50"
    >
      <Download className="h-4 w-4 text-muted" />
      {label}
    </button>
  );
}
