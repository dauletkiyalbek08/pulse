"use client";

import { useState } from "react";
import { Loader2, CheckCircle2 } from "lucide-react";

function getCookie(name: string): string {
  if (typeof document === "undefined") return "";
  const m = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
  return m ? decodeURIComponent(m[2]) : "";
}

/** Форма заявки лендинга: шлёт лид в /api/site/leads с метками рекламы (fbc/fbp). */
export function LandingForm({
  token,
  pixelId,
  buttonText,
  thanksText,
  accent,
}: {
  token: string;
  pixelId: string | null;
  buttonText: string;
  thanksText: string;
  accent: string;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (phone.trim().length < 6) {
      setErr("Введите номер телефона");
      return;
    }
    setBusy(true);
    try {
      const fbc = getCookie("_fbc");
      const fbp = getCookie("_fbp");
      const fbclid = new URLSearchParams(window.location.search).get("fbclid") ?? "";
      const res = await fetch(`/api/site/leads?t=${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, fbc, fbp, fbclid }),
      });
      if (!res.ok) throw new Error();
      const w = window as unknown as { fbq?: (...a: unknown[]) => void };
      if (pixelId && typeof w.fbq === "function") w.fbq("track", "Lead");
      setDone(true);
    } catch {
      setErr("Не удалось отправить. Попробуйте ещё раз.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl bg-white/80 px-6 py-10 text-center shadow-sm">
        <CheckCircle2 className="h-12 w-12" style={{ color: accent }} />
        <p className="text-lg font-semibold text-gray-900">{thanksText}</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Ваше имя"
        className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3.5 text-base text-gray-900 placeholder:text-gray-400 focus:border-gray-400 focus:outline-none"
      />
      <input
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        type="tel"
        inputMode="tel"
        placeholder="Номер телефона"
        className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3.5 text-base text-gray-900 placeholder:text-gray-400 focus:border-gray-400 focus:outline-none"
      />
      {err && <p className="text-sm text-red-600">{err}</p>}
      <button
        type="submit"
        disabled={busy}
        style={{ backgroundColor: accent }}
        className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3.5 text-base font-semibold text-white shadow-sm transition hover:opacity-90 disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
        {buttonText}
      </button>
      <p className="text-center text-xs text-gray-400">
        Нажимая кнопку, вы соглашаетесь на обработку персональных данных
      </p>
    </form>
  );
}
