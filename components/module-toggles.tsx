"use client";

import { useState, useTransition } from "react";
import { getMenuIcon } from "@/components/icons";
import { setProjectModules } from "@/app/p/[projectId]/settings/actions";
import type { MenuSection } from "@/lib/menu";

export function ModuleToggles({
  projectId,
  sections,
  enabled,
}: {
  projectId: string;
  sections: MenuSection[];
  enabled: string[];
}) {
  const [on, setOn] = useState<Set<string>>(new Set(enabled));
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const total = sections.reduce((n, s) => n + s.items.length, 0);
  const activeCount = sections.reduce(
    (n, s) => n + s.items.filter((i) => on.has(i.segment)).length,
    0,
  );

  function toggle(segment: string) {
    const next = new Set(on);
    if (next.has(segment)) next.delete(segment);
    else next.add(segment);
    setOn(next);
    setError(null);
    startTransition(async () => {
      const res = await setProjectModules(projectId, Array.from(next));
      if (!res.ok) {
        setError(res.error ?? "Не удалось сохранить");
        setOn(new Set(on)); // откат
      }
    });
  }

  return (
    <div className="rounded-card bg-surface p-6 shadow-soft ring-1 ring-line">
      <div className="mb-1 flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-ink">Разделы проекта</h2>
        <span className="text-xs text-faint">
          включено {activeCount} из {total}
          {pending && " · сохраняю…"}
        </span>
      </div>
      <p className="mb-5 text-sm text-muted">
        Выключите разделы, которые этому проекту не нужны — они исчезнут из меню у всех
        сотрудников. Главная, Настройки и Права доступа всегда доступны.
      </p>

      {error && (
        <div className="mb-4 rounded-tile bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>
      )}

      <div className="space-y-6">
        {sections.map((section) => (
          <div key={section.title}>
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-faint">
              {section.title}
            </h3>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {section.items.map((item) => {
                const Icon = getMenuIcon(item.icon);
                const isOn = on.has(item.segment);
                return (
                  <button
                    key={item.segment}
                    type="button"
                    role="switch"
                    aria-checked={isOn}
                    disabled={pending}
                    onClick={() => toggle(item.segment)}
                    className={`flex items-center justify-between gap-3 rounded-tile border px-3 py-2.5 text-left transition disabled:opacity-60 ${
                      isOn
                        ? "border-brand bg-brand-soft"
                        : "border-line bg-canvas hover:bg-surface"
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <Icon
                        className={`h-4 w-4 ${isOn ? "text-brand-ink" : "text-faint"}`}
                      />
                      <span
                        className={`text-sm font-medium ${isOn ? "text-ink" : "text-muted"}`}
                      >
                        {item.label}
                      </span>
                    </span>
                    <span
                      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition ${
                        isOn ? "bg-brand" : "bg-line"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${
                          isOn ? "translate-x-4" : "translate-x-0.5"
                        }`}
                      />
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
