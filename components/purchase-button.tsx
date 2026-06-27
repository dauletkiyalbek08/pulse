"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BadgeDollarSign, Loader2, X, Sparkles } from "lucide-react";
import { markPurchase } from "@/app/p/[projectId]/leads/purchase-actions";

export function PurchaseButton({
  projectId,
  leadId,
  leadName,
  fromMeta,
}: {
  projectId: string;
  leadId: string;
  leadName: string;
  fromMeta: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [product, setProduct] = useState("");
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  function submit() {
    const value = Number(amount);
    if (!(value > 0)) {
      setMsg({ kind: "err", text: "Укажите сумму покупки" });
      return;
    }
    setMsg(null);
    start(async () => {
      const res = await markPurchase(projectId, leadId, value, product);
      if (!res.ok) {
        setMsg({ kind: "err", text: res.error ?? "Ошибка" });
        return;
      }
      const capiText =
        res.capi === "sent"
          ? "✅ Покупка записана. Событие ушло в Meta (CAPI)."
          : res.capi === "no_lead_id"
            ? "✅ Покупка записана. Лид не с рекламы — в CAPI не отправлено."
            : res.capi === "error"
              ? `✅ Покупка записана. CAPI: ${res.capiMessage ?? "ошибка"}`
              : "✅ Покупка записана.";
      setMsg({ kind: "ok", text: capiText });
      router.refresh();
      setTimeout(() => {
        setOpen(false);
        setMsg(null);
        setAmount("");
        setProduct("");
      }, 1800);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg bg-brand-soft px-3 py-1.5 text-xs font-semibold text-brand-ink transition hover:bg-brand hover:text-white"
      >
        <BadgeDollarSign className="h-3.5 w-3.5" />
        Покупка
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => !pending && setOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-card bg-surface p-5 shadow-soft ring-1 ring-line"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-semibold text-ink">Отметить покупку</h3>
              <button
                type="button"
                onClick={() => !pending && setOpen(false)}
                className="text-muted transition hover:text-ink"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="mb-4 text-sm text-muted">
              Клиент <span className="font-medium text-ink">{leadName}</span>
            </p>

            <label className="mb-1 block text-xs text-muted">Сумма покупки, ₸</label>
            <input
              type="number"
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="напр. 120000"
              autoFocus
              className="mb-3 w-full rounded-xl border border-line bg-canvas px-3.5 py-2.5 text-sm text-ink placeholder:text-faint focus:border-brand focus:outline-none"
            />

            <label className="mb-1 block text-xs text-muted">Курс / товар (необязательно)</label>
            <input
              value={product}
              onChange={(e) => setProduct(e.target.value)}
              placeholder="напр. Английский — Intensive"
              className="mb-4 w-full rounded-xl border border-line bg-canvas px-3.5 py-2.5 text-sm text-ink placeholder:text-faint focus:border-brand focus:outline-none"
            />

            {fromMeta && (
              <div className="mb-4 flex items-start gap-2 rounded-lg bg-brand-soft px-3 py-2 text-xs text-brand-ink">
                <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Лид с рекламы Meta — при подтверждении покупка автоматически уйдёт в Meta (CAPI)
                для похожих аудиторий.
              </div>
            )}

            {msg && (
              <p
                className={`mb-3 rounded-lg px-3 py-2 text-sm ${
                  msg.kind === "ok" ? "bg-brand-soft text-brand-ink" : "bg-red-50 text-red-600"
                }`}
              >
                {msg.text}
              </p>
            )}

            <button
              type="button"
              onClick={submit}
              disabled={pending}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-strong disabled:opacity-60"
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <BadgeDollarSign className="h-4 w-4" />}
              Подтвердить покупку
            </button>
          </div>
        </div>
      )}
    </>
  );
}
