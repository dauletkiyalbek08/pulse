export interface TopItem {
  name: string;
  value: string;
}

/** Рейтинг (Топ хантеров / Топ менеджеров). */
export function TopList({ items }: { items: TopItem[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-muted">Пока нет данных.</p>;
  }

  return (
    <ol className="space-y-3">
      {items.map((item, i) => (
        <li key={`${item.name}-${i}`} className="flex items-center gap-3">
          <span
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
              i === 0
                ? "bg-brand text-white"
                : "bg-canvas text-muted"
            }`}
          >
            {i + 1}
          </span>
          <span className="flex-1 truncate text-sm font-medium text-ink">
            {item.name}
          </span>
          <span className="text-sm font-semibold text-brand-ink">
            {item.value}
          </span>
        </li>
      ))}
    </ol>
  );
}
