function Bar({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-line ${className ?? ""}`} />;
}

/**
 * Каркас контента страницы проекта — мгновенно показывается при переходе
 * (loading.tsx), пока сервер отдаёт реальные данные. Сайдбар и шапка остаются.
 */
export function ContentSkeleton() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="space-y-2.5">
          <Bar className="h-7 w-52" />
          <Bar className="h-4 w-36" />
        </div>
        <Bar className="h-10 w-40" />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-card bg-surface p-5 shadow-soft ring-1 ring-line"
          >
            <Bar className="h-4 w-20" />
            <Bar className="mt-3 h-7 w-28" />
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-card bg-surface p-6 shadow-soft ring-1 ring-line">
        <Bar className="h-5 w-44" />
        <div className="mt-5 space-y-3">
          {Array.from({ length: 7 }).map((_, i) => (
            <Bar key={i} className="h-9 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
