"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { FINANCE_CATEGORIES } from "@/lib/finance";
import { addFinanceEntry } from "@/app/p/[projectId]/finance/actions";

export function FinanceForm({ projectId, today }: { projectId: string; today: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [kind, setKind] = useState("expense");
  const [category, setCategory] = useState("ad_spend");
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [spentOn, setSpentOn] = useState(today);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await addFinanceEntry(projectId, {
        kind,
        category,
        title,
        amount: Number(amount || 0),
        spent_on: spentOn,
        note,
      });
      if (!res.ok) {
        setError(res.error ?? "Ошибка");
        return;
      }
      setTitle("");
      setAmount("");
      setNote("");
      router.refresh();
    });
  }

  const inputCls =
    "rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink placeholder:text-faint focus:border-brand focus:outline-none";

  return (
    <div className="rounded-card bg-surface p-5 shadow-soft ring-1 ring-line">
      <h2 className="mb-4 text-base font-semibold text-ink">Добавить операцию</h2>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <select value={kind} onChange={(e) => setKind(e.target.value)} className={inputCls}>
          <option value="expense">Расход</option>
          <option value="income">Поступление</option>
        </select>

        <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls}>
          {FINANCE_CATEGORIES.map((c) => (
            <option key={c.key} value={c.key}>
              {c.label}
            </option>
          ))}
        </select>

        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Название"
          className={`${inputCls} col-span-2`}
        />

        <input
          type="number"
          min={0}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Сумма ₸"
          className={inputCls}
        />

        <input
          type="date"
          value={spentOn}
          onChange={(e) => setSpentOn(e.target.value)}
          className={inputCls}
        />
      </div>

      <div className="mt-3 flex flex-col gap-3 sm:flex-row">
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
