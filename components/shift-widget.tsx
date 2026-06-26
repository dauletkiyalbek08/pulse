"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Loader2, LogIn, LogOut, CheckCircle2 } from "lucide-react";
import { startShift, endShift } from "@/app/p/[projectId]/attendance/actions";
import { formatDateTime } from "@/lib/format";

export function ShiftWidget({
  projectId,
  openShift,
  officeSet,
}: {
  projectId: string;
  openShift: { started_at: string } | null;
  officeSet: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busyGeo, setBusyGeo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleStart() {
    setError(null);
    if (!navigator.geolocation) {
      setError("Геолокация не поддерживается этим устройством");
      return;
    }
    setBusyGeo(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setBusyGeo(false);
        startTransition(async () => {
          const res = await startShift(
            projectId,
            pos.coords.latitude,
            pos.coords.longitude,
          );
          if (!res.ok) setError(res.error ?? "Не удалось начать смену");
          else router.refresh();
        });
      },
      () => {
        setBusyGeo(false);
        setError("Не удалось получить геопозицию. Разрешите доступ к локации.");
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  function handleEnd() {
    setError(null);
    startTransition(async () => {
      const res = await endShift(projectId);
      if (!res.ok) setError(res.error ?? "Не удалось завершить смену");
      else router.refresh();
    });
  }

  const busy = pending || busyGeo;

  return (
    <div className="rounded-card bg-surface p-6 shadow-soft ring-1 ring-line">
      {openShift ? (
        <>
          <div className="flex items-center gap-2 text-sm font-semibold text-brand-ink">
            <CheckCircle2 className="h-5 w-5" />
            Вы на смене
          </div>
          <p className="mt-1 text-sm text-muted">
            Начало: {formatDateTime(openShift.started_at)}
          </p>
          <button
            type="button"
            onClick={handleEnd}
            disabled={busy}
            className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl border border-line px-5 py-2.5 text-sm font-semibold text-ink transition hover:bg-canvas disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
            Завершить смену
          </button>
        </>
      ) : (
        <>
          <div className="flex items-center gap-2 text-sm font-semibold text-ink">
            <MapPin className="h-5 w-5 text-muted" />
            Отметка прихода
          </div>
          <p className="mt-1 text-sm text-muted">
            {officeSet
              ? "Нажмите «Начать смену» — проверим, что вы в офисе."
              : "Офис ещё не настроен — смену можно начать без проверки места."}
          </p>
          <button
            type="button"
            onClick={handleStart}
            disabled={busy}
            className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-brand-strong disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
            {busyGeo ? "Определяем геопозицию…" : "Начать смену"}
          </button>
        </>
      )}

      {error && (
        <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
