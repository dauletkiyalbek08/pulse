import { Webhook, ArrowRight } from "lucide-react";
import { requireAccess } from "@/lib/queries";
import { PageHeader } from "@/components/page-header";
import { CapiIntegration } from "@/components/capi-integration";
import { getCapiStatus, getCapiEvents } from "@/app/p/[projectId]/capi/actions";
import { formatCurrency, formatDateTime } from "@/lib/format";

// Активный датасет владельца (PIXEL3) — подставляем как значение по умолчанию.
const DEFAULT_DATASET_ID = "962785768710642";

export default async function CapiPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  await requireAccess(projectId, "capi");

  const [status, events] = await Promise.all([
    getCapiStatus(projectId),
    getCapiEvents(projectId),
  ]);

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <PageHeader
        title="Conversions API"
        subtitle="Отправка покупок в Meta для оптимизации и похожих аудиторий"
      />

      {/* Как это работает */}
      <div className="mb-6 rounded-card bg-surface p-5 shadow-soft ring-1 ring-line">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink">
          <Webhook className="h-4 w-4 text-brand-ink" />
          Как замыкается цикл реклама → продажа
        </div>
        <div className="flex flex-col gap-2 text-sm text-muted sm:flex-row sm:items-center sm:gap-1">
          <Step text="Лид с формы Meta" />
          <ArrowRight className="hidden h-4 w-4 shrink-0 text-faint sm:block" />
          <Step text="Менеджер отмечает «Покупка» в CRM" />
          <ArrowRight className="hidden h-4 w-4 shrink-0 text-faint sm:block" />
          <Step text="Purchase летит в Meta (с привязкой к креативу)" />
          <ArrowRight className="hidden h-4 w-4 shrink-0 text-faint sm:block" />
          <Step text="Meta строит lookalike" />
        </div>
      </div>

      <div className="mb-8">
        <CapiIntegration projectId={projectId} status={status} defaultDatasetId={DEFAULT_DATASET_ID} />
      </div>

      <h2 className="mb-3 text-base font-semibold text-ink">Отправленные события</h2>
      {events.length === 0 ? (
        <div className="rounded-card border border-dashed border-line bg-surface px-6 py-12 text-center text-sm text-muted">
          Событий пока нет. Они появятся, когда менеджер отметит покупку по лиду с рекламы.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-card bg-surface shadow-soft ring-1 ring-line">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-faint">
                <th className="px-5 py-3 font-medium">Время</th>
                <th className="px-5 py-3 font-medium">Событие</th>
                <th className="px-5 py-3 text-right font-medium">Сумма</th>
                <th className="px-5 py-3 font-medium">Статус</th>
                <th className="px-5 py-3 font-medium">Ответ Meta</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id} className="border-b border-line last:border-0">
                  <td className="px-5 py-3 whitespace-nowrap text-muted">{formatDateTime(e.createdAt)}</td>
                  <td className="px-5 py-3 font-medium text-ink">{e.eventName}</td>
                  <td className="px-5 py-3 text-right text-ink">{formatCurrency(e.value)}</td>
                  <td className="px-5 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        e.status === "sent"
                          ? "bg-brand-soft text-brand-ink"
                          : "bg-red-50 text-red-600"
                      }`}
                    >
                      {e.status === "sent" ? "Отправлено" : "Ошибка"}
                    </span>
                  </td>
                  <td className="max-w-[260px] truncate px-5 py-3 text-xs text-faint">
                    {e.response ?? "—"}
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

function Step({ text }: { text: string }) {
  return (
    <span className="rounded-lg bg-canvas px-3 py-1.5 text-center text-xs font-medium text-ink">
      {text}
    </span>
  );
}
