"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Check } from "lucide-react";
import { setUsdRate } from "@/app/p/[projectId]/finance/actions";

/** Инлайн-редактор курса $ → ₸ для пересчёта рекламы в «Финансах». */
export function UsdRateEditor({ projectId, rate }: { projectId: string; rate: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [value, setValue] = useState(String(rate));
  const [saved, setSaved] = useState(false);

  function save() {
    startTransition(async () => {
      const res = await setUsdRate(projectId, Number(value || 0));
      if (res.ok) {
        setSaved(true);
        router.refresh();
        setTimeout(() => setSaved(false), 2000);
      }
    });
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="text-muted">курс $→₸</span>
      <input
        type="number"
        min={1}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setSaved(false);
        }}
        className="w-20 rounded-lg border border-line bg-surface px-2 py-1 text-sm text-ink focus:border-brand focus:outline-none"
      />
      <button
        type="button"
        onClick={save}
        disabled={pending}
        className="inline-flex items-center gap-1 rounded-lg bg-brand px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-brand-strong disabled:opacity-60"
      >
        {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : saved ? <Check className="h-3.5 w-3.5" /> : null}
        {saved ? "Ок" : "Применить"}
      </button>
    </span>
  );
}
