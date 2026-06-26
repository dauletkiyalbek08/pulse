"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Crosshair, Loader2, Save } from "lucide-react";
import { saveOffice } from "@/app/p/[projectId]/attendance/actions";

export function OfficeSetup({
  projectId,
  lat,
  lng,
  radius,
  address,
}: {
  projectId: string;
  lat: number | null;
  lng: number | null;
  radius: number;
  address: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busyGeo, setBusyGeo] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    lat: lat?.toString() ?? "",
    lng: lng?.toString() ?? "",
    radius: radius.toString(),
    address: address ?? "",
  });

  function useMyLocation() {
    setError(null);
    setMsg(null);
    if (!navigator.geolocation) {
      setError("Геолокация не поддерживается");
      return;
    }
    setBusyGeo(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setBusyGeo(false);
        setForm((f) => ({
          ...f,
          lat: pos.coords.latitude.toFixed(6),
          lng: pos.coords.longitude.toFixed(6),
        }));
        setMsg("Координаты офиса взяты из вашего текущего местоположения.");
      },
      () => {
        setBusyGeo(false);
        setError("Не удалось получить геопозицию.");
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  function save() {
    setError(null);
    setMsg(null);
    const latN = Number(form.lat);
    const lngN = Number(form.lng);
    const radN = Number(form.radius);
    if (!Number.isFinite(latN) || !Number.isFinite(lngN)) {
      setError("Укажите координаты офиса (можно кнопкой выше).");
      return;
    }
    startTransition(async () => {
      const res = await saveOffice(projectId, latN, lngN, radN, form.address);
      if (!res.ok) setError(res.error ?? "Ошибка сохранения");
      else {
        setMsg("Офис сохранён.");
        router.refresh();
      }
    });
  }

  const inputClass =
    "mt-1.5 w-full rounded-xl border border-line bg-canvas px-3.5 py-2.5 text-sm text-ink placeholder:text-faint focus:border-brand focus:bg-surface focus:outline-none";

  return (
    <div className="rounded-card bg-surface p-6 shadow-soft ring-1 ring-line">
      <h2 className="text-base font-semibold text-ink">Точка офиса</h2>
      <p className="mt-1 text-sm text-muted">
        По ней проверяется геолокация при отметке смены. Откройте эту страницу
        находясь в офисе и нажмите «Взять моё местоположение».
      </p>

      <button
        type="button"
        onClick={useMyLocation}
        disabled={busyGeo}
        className="mt-4 inline-flex items-center gap-2 rounded-xl border border-line px-4 py-2 text-sm font-medium text-ink transition hover:bg-canvas disabled:opacity-60"
      >
        {busyGeo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crosshair className="h-4 w-4" />}
        Взять моё местоположение
      </button>

      <div className="mt-4 grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium text-ink">Широта</label>
          <input
            value={form.lat}
            onChange={(e) => setForm((f) => ({ ...f, lat: e.target.value }))}
            placeholder="43.238949"
            className={inputClass}
          />
        </div>
        <div>
          <label className="text-sm font-medium text-ink">Долгота</label>
          <input
            value={form.lng}
            onChange={(e) => setForm((f) => ({ ...f, lng: e.target.value }))}
            placeholder="76.889709"
            className={inputClass}
          />
        </div>
        <div>
          <label className="text-sm font-medium text-ink">Радиус, м</label>
          <input
            type="number"
            min={10}
            value={form.radius}
            onChange={(e) => setForm((f) => ({ ...f, radius: e.target.value }))}
            className={inputClass}
          />
        </div>
        <div>
          <label className="text-sm font-medium text-ink">Адрес (необяз.)</label>
          <input
            value={form.address}
            onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
            placeholder="ул. Достык 1"
            className={inputClass}
          />
        </div>
      </div>

      <button
        type="button"
        onClick={save}
        disabled={pending}
        className="mt-4 inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-brand-strong disabled:opacity-60"
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Сохранить офис
      </button>

      <p className="mt-3 text-xs text-faint">
        Подсказка: GPS в телефоне обычно ошибается на 10–50 м, поэтому слишком
        маленький радиус может не пускать даже из офиса. Рекомендуем 50–100 м.
      </p>

      {msg && <p className="mt-3 text-sm text-brand-ink">{msg}</p>}
      {error && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
