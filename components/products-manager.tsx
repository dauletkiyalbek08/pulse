"use client";

import { useRef, useState, useTransition } from "react";
import { Plus, Minus, Pencil, Trash2, Check, X } from "lucide-react";
import { Pill } from "@/components/pill";
import { formatCurrency, formatNumber } from "@/lib/format";
import {
  addProduct,
  updateProduct,
  adjustStock,
  deleteProduct,
} from "@/app/p/[projectId]/products/actions";

export interface ProductRow {
  id: string;
  name: string;
  sku: string | null;
  stock_quantity: number;
  cost_price: number;
  sale_price: number;
  low_stock_threshold: number;
}

const inputCls =
  "w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-ink placeholder:text-faint focus:border-brand focus:outline-none";

export function ProductsManager({
  projectId,
  products,
}: {
  projectId: string;
  products: ProductRow[];
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ProductRow | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  function submitAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError(null);
    startTransition(async () => {
      const res = await addProduct(projectId, fd);
      if (!res.ok) setError(res.error ?? "Ошибка");
      else {
        formRef.current?.reset();
        setShowAdd(false);
      }
    });
  }

  function startEdit(p: ProductRow) {
    setEditingId(p.id);
    setDraft({ ...p });
  }

  function saveEdit() {
    if (!draft) return;
    startTransition(async () => {
      await updateProduct(projectId, draft.id, {
        name: draft.name.trim() || "Без названия",
        sku: draft.sku?.trim() || null,
        stock_quantity: Math.max(0, Math.trunc(draft.stock_quantity) || 0),
        cost_price: Math.max(0, draft.cost_price || 0),
        sale_price: Math.max(0, draft.sale_price || 0),
        low_stock_threshold: Math.max(0, Math.trunc(draft.low_stock_threshold) || 0),
      });
      setEditingId(null);
      setDraft(null);
    });
  }

  function bump(id: string, delta: number) {
    startTransition(async () => {
      await adjustStock(projectId, id, delta);
    });
  }

  function remove(p: ProductRow) {
    if (!confirm(`Удалить товар «${p.name}»?`)) return;
    startTransition(async () => {
      await deleteProduct(projectId, p.id);
    });
  }

  return (
    <div>
      {/* Кнопка / форма добавления */}
      <div className="mb-4 flex justify-end">
        <button
          type="button"
          onClick={() => setShowAdd((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-3.5 py-2 text-sm font-medium text-white transition hover:bg-brand-strong"
        >
          <Plus className="h-4 w-4" />
          Добавить товар
        </button>
      </div>

      {showAdd && (
        <form
          ref={formRef}
          onSubmit={submitAdd}
          className="mb-5 rounded-card bg-surface p-5 shadow-soft ring-1 ring-line"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="text-sm">
              <span className="mb-1 block font-medium text-ink">Название*</span>
              <input name="name" required placeholder="Например, Духи Arabian" className={inputCls} />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium text-ink">SKU / артикул</span>
              <input name="sku" placeholder="ARB-001" className={inputCls} />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium text-ink">Остаток на складе</span>
              <input name="stock_quantity" type="number" min="0" defaultValue={0} className={inputCls} />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium text-ink">Себестоимость, ₸</span>
              <input name="cost_price" type="number" min="0" step="0.01" defaultValue={0} className={inputCls} />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium text-ink">Цена продажи, ₸</span>
              <input name="sale_price" type="number" min="0" step="0.01" defaultValue={0} className={inputCls} />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium text-ink">Порог «заканчивается»</span>
              <input name="low_stock_threshold" type="number" min="0" defaultValue={5} className={inputCls} />
            </label>
          </div>
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
          <div className="mt-4 flex gap-2">
            <button
              type="submit"
              disabled={pending}
              className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-strong disabled:opacity-60"
            >
              {pending ? "Сохраняю…" : "Сохранить товар"}
            </button>
            <button
              type="button"
              onClick={() => setShowAdd(false)}
              className="rounded-xl border border-line px-4 py-2 text-sm font-medium text-muted transition hover:bg-canvas"
            >
              Отмена
            </button>
          </div>
        </form>
      )}

      {products.length === 0 ? (
        <div className="rounded-card border border-dashed border-line bg-surface px-6 py-16 text-center text-sm text-muted">
          Товаров пока нет. Добавьте первый — кнопкой выше.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-card bg-surface shadow-soft ring-1 ring-line">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-faint">
                <th className="px-5 py-3 font-medium">Товар</th>
                <th className="px-5 py-3 font-medium">SKU</th>
                <th className="px-5 py-3 text-right font-medium">На складе</th>
                <th className="px-5 py-3 text-right font-medium">Себестоимость</th>
                <th className="px-5 py-3 text-right font-medium">Цена продажи</th>
                <th className="px-5 py-3 text-right font-medium">Маржа</th>
                <th className="px-5 py-3 text-right font-medium">Действия</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => {
                const editing = editingId === p.id;
                const low = p.stock_quantity <= p.low_stock_threshold;
                const margin = Number(p.sale_price) - Number(p.cost_price);

                if (editing && draft) {
                  return (
                    <tr key={p.id} className="border-b border-line last:border-0 bg-brand-soft/40">
                      <td className="px-5 py-2.5">
                        <input
                          value={draft.name}
                          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                          className={inputCls}
                        />
                      </td>
                      <td className="px-5 py-2.5">
                        <input
                          value={draft.sku ?? ""}
                          onChange={(e) => setDraft({ ...draft, sku: e.target.value })}
                          className={inputCls}
                        />
                      </td>
                      <td className="px-5 py-2.5">
                        <input
                          type="number"
                          min="0"
                          value={draft.stock_quantity}
                          onChange={(e) => setDraft({ ...draft, stock_quantity: Number(e.target.value) })}
                          className={`${inputCls} text-right`}
                        />
                      </td>
                      <td className="px-5 py-2.5">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={draft.cost_price}
                          onChange={(e) => setDraft({ ...draft, cost_price: Number(e.target.value) })}
                          className={`${inputCls} text-right`}
                        />
                      </td>
                      <td className="px-5 py-2.5">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={draft.sale_price}
                          onChange={(e) => setDraft({ ...draft, sale_price: Number(e.target.value) })}
                          className={`${inputCls} text-right`}
                        />
                      </td>
                      <td className="px-5 py-2.5 text-right text-faint">—</td>
                      <td className="px-5 py-2.5">
                        <div className="flex justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={saveEdit}
                            disabled={pending}
                            className="rounded-lg bg-brand p-1.5 text-white transition hover:bg-brand-strong disabled:opacity-60"
                            title="Сохранить"
                          >
                            <Check className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingId(null);
                              setDraft(null);
                            }}
                            className="rounded-lg border border-line p-1.5 text-muted transition hover:bg-canvas"
                            title="Отмена"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                }

                return (
                  <tr key={p.id} className="border-b border-line last:border-0 transition hover:bg-canvas">
                    <td className="px-5 py-3 font-medium text-ink">{p.name}</td>
                    <td className="px-5 py-3 text-muted">{p.sku ?? "—"}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => bump(p.id, -1)}
                          disabled={pending || p.stock_quantity === 0}
                          className="rounded-md border border-line p-1 text-muted transition hover:bg-canvas disabled:opacity-40"
                          title="−1"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="min-w-[2.5rem] text-right text-ink">
                          {formatNumber(p.stock_quantity)}
                        </span>
                        <button
                          type="button"
                          onClick={() => bump(p.id, 1)}
                          disabled={pending}
                          className="rounded-md border border-line p-1 text-muted transition hover:bg-canvas disabled:opacity-40"
                          title="+1"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                        {low && <Pill tone="warning">мало</Pill>}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-right text-muted">{formatCurrency(Number(p.cost_price))}</td>
                    <td className="px-5 py-3 text-right text-ink">{formatCurrency(Number(p.sale_price))}</td>
                    <td className="px-5 py-3 text-right font-semibold text-brand-ink">{formatCurrency(margin)}</td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => startEdit(p)}
                          className="rounded-lg border border-line p-1.5 text-muted transition hover:bg-canvas"
                          title="Изменить"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => remove(p)}
                          className="rounded-lg border border-line p-1.5 text-muted transition hover:bg-red-50 hover:text-red-600"
                          title="Удалить"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
