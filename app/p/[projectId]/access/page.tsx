import { ShieldCheck, Check, Minus } from "lucide-react";
import { getProject, requireAccess } from "@/lib/queries";
import { getNiche } from "@/lib/niches";
import { getMenu } from "@/lib/menu";
import {
  ROLE_ORDER,
  ROLE_DESC,
  ACTION_MATRIX,
  canAccess,
  filterMenuByRole,
} from "@/lib/access";
import { roleLabel } from "@/lib/members";
import { PageHeader } from "@/components/page-header";

/** Короткие подписи ролей для шапок матриц. */
const ROLE_SHORT: Record<string, string> = {
  director: "Директор",
  head_sales: "РОП",
  manager: "Менеджер",
  hunter: "Хантер",
  teacher: "Учитель",
  marketer: "Маркетолог",
  targetologist: "Таргетолог",
  smm: "SMM",
  accountant: "Бухгалтер",
};

function Cell({ on }: { on: boolean }) {
  return (
    <td className="px-3 py-3 text-center">
      {on ? (
        <Check className="mx-auto h-4 w-4 text-brand" />
      ) : (
        <Minus className="mx-auto h-4 w-4 text-faint" />
      )}
    </td>
  );
}

export default async function AccessPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  await requireAccess(projectId, "access");

  const project = await getProject(projectId);
  const niche = getNiche(project?.niche);
  const menu = getMenu(niche.key);

  // Плоский список разделов для матрицы страниц
  const pages = menu.flatMap((s) => s.items.map((i) => ({ label: i.label, segment: i.segment })));

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <PageHeader
        title="Права доступа"
        subtitle="Матрица доступа ролей к разделам и действиям"
      />

      {/* Карточки ролей */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {ROLE_ORDER.map((role) => {
          const count = filterMenuByRole(menu, role).reduce(
            (n, s) => n + s.items.length,
            0,
          );
          return (
            <div
              key={role}
              className="rounded-card bg-surface p-5 shadow-soft ring-1 ring-line"
            >
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-tile bg-brand-soft text-brand-ink">
                  <ShieldCheck className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <div className="font-semibold text-ink">{roleLabel(role)}</div>
                  <div className="text-xs text-muted">{count} разделов</div>
                </div>
              </div>
              <p className="mt-3 text-sm text-muted">{ROLE_DESC[role]}</p>
            </div>
          );
        })}
      </div>

      {/* Матрица прав (действия) */}
      <section className="mb-8">
        <h2 className="text-base font-semibold text-ink">Матрица прав</h2>
        <p className="mb-3 text-sm text-muted">Кто что может делать в системе</p>
        <div className="overflow-x-auto rounded-card bg-surface shadow-soft ring-1 ring-line">
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="border-b border-line text-xs uppercase tracking-wide text-faint">
                <th className="px-5 py-3 text-left font-medium">Действие</th>
                {ROLE_ORDER.map((r) => (
                  <th key={r} className="px-3 py-3 text-center font-medium">
                    {ROLE_SHORT[r]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ACTION_MATRIX.map((row) => (
                <tr key={row.label} className="border-b border-line last:border-0">
                  <td className="px-5 py-3 font-medium text-ink">{row.label}</td>
                  {ROLE_ORDER.map((r) => (
                    <Cell key={r} on={row.roles.includes(r)} />
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Доступ к страницам */}
      <section>
        <h2 className="text-base font-semibold text-ink">Доступ к страницам</h2>
        <p className="mb-3 text-sm text-muted">Какие разделы видит каждая роль в меню</p>
        <div className="overflow-x-auto rounded-card bg-surface shadow-soft ring-1 ring-line">
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="border-b border-line text-xs uppercase tracking-wide text-faint">
                <th className="px-5 py-3 text-left font-medium">Раздел</th>
                {ROLE_ORDER.map((r) => (
                  <th key={r} className="px-3 py-3 text-center font-medium">
                    {ROLE_SHORT[r]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pages.map((p) => (
                <tr key={p.segment || "home"} className="border-b border-line last:border-0">
                  <td className="px-5 py-3 font-medium text-ink">{p.label}</td>
                  {ROLE_ORDER.map((r) => (
                    <Cell key={r} on={canAccess(r, p.segment)} />
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
