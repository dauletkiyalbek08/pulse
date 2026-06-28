export interface ReportColumn {
  label: string;
  align?: "left" | "right";
}

/**
 * Простая таблица отчёта: строки уже отформатированы (строки/числа).
 * Первая колонка по умолчанию слева, остальные — справа (числа).
 */
export function ReportTable({
  columns,
  rows,
  total,
  empty = "Нет данных за период.",
}: {
  columns: ReportColumn[];
  rows: (string | number)[][];
  total?: (string | number)[];
  empty?: string;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-card border border-dashed border-line bg-surface px-6 py-10 text-center text-sm text-muted">
        {empty}
      </div>
    );
  }

  const alignAt = (i: number): "left" | "right" => columns[i]?.align ?? (i === 0 ? "left" : "right");
  const cellCls = (i: number) =>
    alignAt(i) === "right" ? "px-4 py-3 text-right tabular-nums" : "px-4 py-3 text-left";

  return (
    <div className="overflow-x-auto rounded-card bg-surface shadow-card ring-1 ring-line">
      <table className="w-full min-w-[560px] text-sm">
        <thead>
          <tr className="border-b border-line bg-canvas/60 text-xs font-medium uppercase tracking-wide text-faint">
            {columns.map((c, i) => (
              <th key={i} className={alignAt(i) === "right" ? "px-4 py-3 text-right" : "px-4 py-3 text-left"}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri} className="border-b border-line last:border-0 transition hover:bg-canvas">
              {r.map((v, ci) => (
                <td key={ci} className={`${cellCls(ci)} ${ci === 0 ? "font-medium text-ink" : "text-muted"}`}>
                  {v}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {total && (
          <tfoot>
            <tr className="border-t-2 border-line bg-canvas/60 font-semibold text-ink">
              {total.map((v, ci) => (
                <td key={ci} className={cellCls(ci)}>
                  {v}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
