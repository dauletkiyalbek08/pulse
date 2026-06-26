"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Calendar, ChevronDown } from "lucide-react";
import { RANGE_PRESETS, type RangePreset } from "@/lib/date-range";

export function DateRangePicker({
  preset,
  from,
  to,
  label,
}: {
  preset: RangePreset;
  from: string;
  to: string;
  label: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [customFrom, setCustomFrom] = useState(from);
  const [customTo, setCustomTo] = useState(to);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function navigate(params: URLSearchParams) {
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    setOpen(false);
  }

  function pickPreset(key: RangePreset) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("range", key);
    params.delete("from");
    params.delete("to");
    navigate(params);
  }

  function applyCustom() {
    const params = new URLSearchParams(searchParams.toString());
    params.set("range", "custom");
    params.set("from", customFrom);
    params.set("to", customTo);
    navigate(params);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 rounded-xl border border-line bg-surface px-3.5 py-2 text-sm font-medium text-ink shadow-soft transition hover:bg-canvas"
      >
        <Calendar className="h-4 w-4 text-muted" />
        {label}
        <ChevronDown className="h-4 w-4 text-faint" />
      </button>

      {open && (
        <div className="absolute right-0 z-30 mt-2 w-64 rounded-card border border-line bg-surface p-2 shadow-card">
          <ul className="space-y-0.5">
            {RANGE_PRESETS.map((p) => (
              <li key={p.key}>
                <button
                  type="button"
                  onClick={() => pickPreset(p.key)}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition hover:bg-canvas ${
                    preset === p.key ? "font-semibold text-brand-ink" : "text-ink"
                  }`}
                >
                  {p.label}
                  {preset === p.key && <span className="h-1.5 w-1.5 rounded-full bg-brand" />}
                </button>
              </li>
            ))}
          </ul>

          <div className="mt-2 border-t border-line pt-2">
            <div className="px-1 pb-1.5 text-xs font-medium text-muted">
              Произвольный диапазон
            </div>
            <div className="flex items-center gap-2 px-1">
              <input
                type="date"
                value={customFrom}
                max={customTo}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="w-full rounded-lg border border-line bg-canvas px-2 py-1.5 text-xs text-ink focus:border-brand focus:outline-none"
              />
              <span className="text-faint">–</span>
              <input
                type="date"
                value={customTo}
                min={customFrom}
                onChange={(e) => setCustomTo(e.target.value)}
                className="w-full rounded-lg border border-line bg-canvas px-2 py-1.5 text-xs text-ink focus:border-brand focus:outline-none"
              />
            </div>
            <button
              type="button"
              onClick={applyCustom}
              className="mt-2 w-full rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white transition hover:bg-brand-strong"
            >
              Применить
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
