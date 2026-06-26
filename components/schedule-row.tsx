"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Check, Clock } from "lucide-react";
import { saveSchedule } from "@/app/p/[projectId]/schedules/actions";
import { roleLabel } from "@/lib/members";
import { WEEK_DAYS } from "@/lib/teams";
import { Avatar } from "@/components/avatar";

export function ScheduleRow({
  projectId,
  userId,
  name,
  role,
  initialDays,
  initialStart,
  initialEnd,
}: {
  projectId: string;
  userId: string;
  name: string;
  role: string;
  initialDays: number[];
  initialStart: string;
  initialEnd: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [days, setDays] = useState<number[]>(initialDays);
  const [start, setStart] = useState(initialStart);
  const [end, setEnd] = useState(initialEnd);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(iso: number) {
    setSaved(false);
    setDays((d) =>
      d.includes(iso) ? d.filter((x) => x !== iso) : [...d, iso].sort((a, b) => a - b),
    );
  }

  function save() {
    setError(null);
    startTransition(async () => {
      const res = await saveSchedule(projectId, userId, days, start, end);
      if (!res.ok) setError(res.error ?? "Ошибка");
      else {
        setSaved(true);
        router.refresh();
        setTimeout(() => setSaved(false), 2000);
      }
    });
  }

  return (
    <div className="rounded-card bg-surface p-4 shadow-soft ring-1 ring-line">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Avatar name={name} />
          <div className="min-w-0">
            <div className="truncate font-medium text-ink">{name}</div>
            <div className="text-xs text-muted">{roleLabel(role)}</div>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {WEEK_DAYS.map((d) => {
            const on = days.includes(d.iso);
            return (
              <button
                key={d.iso}
                type="button"
                onClick={() => toggle(d.iso)}
                className={`h-9 w-9 rounded-lg text-sm font-medium transition ${
                  on
                    ? "bg-brand text-white"
                    : "border border-line bg-canvas text-muted hover:text-ink"
                }`}
              >
                {d.short}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-faint" />
          <input
            type="time"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="rounded-lg border border-line bg-canvas px-2.5 py-2 text-sm text-ink focus:border-brand focus:outline-none"
          />
          <span className="text-faint">—</span>
          <input
            type="time"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            className="rounded-lg border border-line bg-canvas px-2.5 py-2 text-sm text-ink focus:border-brand focus:outline-none"
          />
        </div>

        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-strong disabled:opacity-60"
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : saved ? (
            <Check className="h-4 w-4" />
          ) : null}
          {saved ? "Сохранено" : "Сохранить"}
        </button>
      </div>

      {error && (
        <p className="mt-2 rounded-lg bg-red-50 px-3 py-1.5 text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
