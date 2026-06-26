"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { AD_CHANNELS, AD_OBJECTIVES } from "@/lib/ads";
import { addAdSpend } from "@/app/p/[projectId]/ads/actions";

export function AdSpendForm({ projectId, today }: { projectId: string; today: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [channel, setChannel] = useState("meta");
  const [objective, setObjective] = useState("course");
  const [campaign, setCampaign] = useState("");
  const [amount, setAmount] = useState("");
  const [leads, setLeads] = useState("");
  const [spentOn, setSpentOn] = useState(today);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await addAdSpend(projectId, {
        channel,
        objective,
        campaign,
        amount: Number(amount || 0),
        spent_on: spentOn,
        leads: Number(leads || 0),
        note,
      });
      if (!res.ok) {
        setError(res.error ?? "Ошибка");
        return;
      }
      setCampaign("");
      setAmount("");
      setLeads("");
      setNote("");
      router.refresh();
    });
  }

  const inputCls =
    "rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink placeholder:text-faint focus:border-brand focus:outline-none";

  return (
    <div className="rounded-card bg-surface p-5 shadow-soft ring-1 ring-line">
      <h2 className="mb-4 text-base font-semibold text-ink">Добавить расход на рекламу</h2>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <select value={channel} onChange={(e) => setChannel(e.target.value)} className={inputCls}>
          {AD_CHANNELS.map((c) => (
            <option key={c.key} value={c.key}>
              {c.label}
            </option>
          ))}
        </select>

        <select value={objective} onChange={(e) => setObjective(e.target.value)} className={inputCls}>
          {AD_OBJECTIVES.map((o) => (
            <option key={o.key} value={o.key}>
              {o.label}
            </option>
          ))}
        </select>

        <input
          value={campaign}
          onChange={(e) => setCampaign(e.target.value)}
          placeholder="Кампания"
          className={`${inputCls} col-span-2`}
        />

        <input
          type="number"
          min={0}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Расход ₸"
          className={inputCls}
        />

        <input
          type="number"
          min={0}
          value={leads}
          onChange={(e) => setLeads(e.target.value)}
          placeholder="Лидов"
          className={inputCls}
        />
      </div>

      <div className="mt-3 flex flex-col gap-3 sm:flex-row">
        <input
          type="date"
          value={spentOn}
          onChange={(e) => setSpentOn(e.target.value)}
          className={inputCls}
        />
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Комментарий (необязательно)"
          className={`${inputCls} flex-1`}
        />
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand px-5 py-2 text-sm font-semibold text-white transition hover:bg-brand-strong disabled:opacity-60"
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Добавить
        </button>
      </div>

      {error && (
        <p className="mt-2 rounded-lg bg-red-50 px-3 py-1.5 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}
