"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Calendar, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { RANGE_PRESETS, type RangePreset } from "@/lib/date-range";

const MONTHS = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];
const WD = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;
const daysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
const firstWeekday = (y: number, m: number) => (new Date(y, m, 1).getDay() + 6) % 7; // Пн=0

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
  const [selFrom, setSelFrom] = useState<string | null>(from);
  const [selTo, setSelTo] = useState<string | null>(to);
  const initial = new Date(`${from}T00:00:00`);
  const [viewY, setViewY] = useState(initial.getFullYear());
  const [viewM, setViewM] = useState(initial.getMonth());
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
    if (!selFrom) return;
    const a = selFrom;
    const b = selTo ?? selFrom;
    const [f, t] = a <= b ? [a, b] : [b, a];
    const params = new URLSearchParams(searchParams.toString());
    params.set("range", "custom");
    params.set("from", f);
    params.set("to", t);
    navigate(params);
  }

  function clickDay(d: string) {
    if (!selFrom || (selFrom && selTo)) {
      setSelFrom(d);
      setSelTo(null);
    } else if (d < selFrom) {
      setSelTo(selFrom);
      setSelFrom(d);
    } else {
      setSelTo(d);
    }
  }

  const cells = useMemo(() => {
    const lead = firstWeekday(viewY, viewM);
    const total = daysInMonth(viewY, viewM);
    const arr: (string | null)[] = Array(lead).fill(null);
    for (let d = 1; d <= total; d++) arr.push(ymd(viewY, viewM, d));
    return arr;
  }, [viewY, viewM]);

  const rangeFrom = selFrom && selTo ? (selFrom <= selTo ? selFrom : selTo) : selFrom;
  const rangeTo = selFrom && selTo ? (selFrom <= selTo ? selTo : selFrom) : selFrom;

  function prevMonth() {
    const m = viewM - 1;
    if (m < 0) { setViewM(11); setViewY(viewY - 1); } else setViewM(m);
  }
  function nextMonth() {
    const m = viewM + 1;
    if (m > 11) { setViewM(0); setViewY(viewY + 1); } else setViewM(m);
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
        <div className="absolute right-0 z-30 mt-2 flex w-[420px] max-w-[90vw] flex-col gap-0 overflow-hidden rounded-card border border-line bg-surface shadow-card sm:flex-row">
          {/* Пресеты */}
          <ul className="max-h-[320px] overflow-y-auto border-b border-line p-2 sm:w-[160px] sm:border-b-0 sm:border-r">
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

          {/* Календарь */}
          <div className="p-3">
            <div className="mb-2 flex items-center justify-between">
              <button
                type="button"
                onClick={prevMonth}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-muted hover:bg-canvas hover:text-ink"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-sm font-semibold text-ink">
                {MONTHS[viewM]} {viewY}
              </span>
              <button
                type="button"
                onClick={nextMonth}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-muted hover:bg-canvas hover:text-ink"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-0.5 text-center">
              {WD.map((w) => (
                <div key={w} className="py-1 text-[11px] font-medium text-faint">{w}</div>
              ))}
              {cells.map((d, i) => {
                if (!d) return <div key={`b${i}`} />;
                const day = Number(d.slice(8, 10));
                const isEdge = d === rangeFrom || d === rangeTo;
                const inRange = rangeFrom && rangeTo && d > rangeFrom && d < rangeTo;
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => clickDay(d)}
                    className={`h-8 rounded-lg text-sm transition ${
                      isEdge
                        ? "bg-brand font-semibold text-white"
                        : inRange
                          ? "bg-brand-soft text-brand-ink"
                          : "text-ink hover:bg-canvas"
                    }`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>

            <div className="mt-3 flex items-center justify-between gap-2">
              <span className="text-xs text-muted">
                {rangeFrom ? rangeFrom.split("-").reverse().join(".") : "—"}
                {" – "}
                {rangeTo ? rangeTo.split("-").reverse().join(".") : "…"}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-3 py-1.5 text-sm text-muted hover:text-ink"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  onClick={applyCustom}
                  disabled={!selFrom}
                  className="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-brand-strong disabled:opacity-50"
                >
                  Применить
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
