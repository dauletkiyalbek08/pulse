"use client";

import { useState, useTransition, type TransitionStartFunction } from "react";
import { useRouter } from "next/navigation";
import { FileText, Plus, Printer, Download, Trash2, Pencil, Sparkles, FilePlus2 } from "lucide-react";
import {
  seedSampleTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  createDocument,
  updateDocumentStatus,
  deleteDocument,
} from "@/app/p/[projectId]/contracts/actions";
import {
  extractPlaceholders,
  fillTemplate,
  prettifyPlaceholder,
  CATEGORY_LABEL,
} from "@/lib/document-samples";
import { formatDateTime } from "@/lib/format";

export interface TemplateRow {
  id: string;
  name: string;
  category: string;
  body: string;
  is_sample: boolean;
}
export interface DocumentRow {
  id: string;
  title: string;
  category: string;
  body: string;
  employeeName: string | null;
  status: string;
  created_at: string;
}
export interface EmployeeOpt {
  id: string;
  name: string;
}

const STATUS_LABEL: Record<string, string> = { draft: "Черновик", signed: "Подписан", archived: "Архив" };
const STATUS_TONE: Record<string, string> = {
  draft: "bg-canvas text-muted ring-1 ring-line",
  signed: "bg-emerald-100 text-emerald-700",
  archived: "bg-amber-100 text-amber-700",
};
const catLabel = (c: string) => CATEGORY_LABEL[c as keyof typeof CATEGORY_LABEL] ?? "Прочее";
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const todayStr = () => new Date().toLocaleDateString("ru-RU");

function openPrintable(title: string, body: string, download: boolean) {
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>body{font-family:Arial,system-ui,sans-serif;color:#111;line-height:1.6;font-size:14px;max-width:720px;margin:40px auto;padding:0 24px;white-space:pre-wrap;}</style>
</head><body>${esc(body)}</body></html>`;
  if (download) {
    const blob = new Blob([html], { type: "application/msword" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${title}.doc`;
    a.click();
    URL.revokeObjectURL(a.href);
    return;
  }
  const w = window.open("", "_blank", "width=820,height=920");
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 250);
}

export function ContractsView({
  projectId,
  templates,
  documents,
  employees,
}: {
  projectId: string;
  templates: TemplateRow[];
  documents: DocumentRow[];
  employees: EmployeeOpt[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [tab, setTab] = useState<"docs" | "templates">("docs");
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <div className="mb-6 inline-flex rounded-xl border border-line bg-canvas p-0.5">
        {(["docs", "templates"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-lg px-4 py-1.5 text-sm transition ${
              tab === t ? "bg-surface font-medium text-ink shadow-soft" : "text-muted hover:text-ink"
            }`}
          >
            {t === "docs" ? `Документы${documents.length ? ` · ${documents.length}` : ""}` : `Шаблоны${templates.length ? ` · ${templates.length}` : ""}`}
          </button>
        ))}
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {tab === "docs" ? (
        <DocsTab
          projectId={projectId}
          templates={templates}
          documents={documents}
          employees={employees}
          pending={pending}
          start={start}
          setError={setError}
          router={router}
        />
      ) : (
        <TemplatesTab
          projectId={projectId}
          templates={templates}
          pending={pending}
          start={start}
          setError={setError}
          router={router}
          goGenerate={() => setTab("docs")}
        />
      )}
    </div>
  );
}

/* ---------- Документы ---------- */

type Starter = TransitionStartFunction;

function DocsTab({
  projectId,
  templates,
  documents,
  employees,
  pending,
  start,
  setError,
  router,
}: {
  projectId: string;
  templates: TemplateRow[];
  documents: DocumentRow[];
  employees: EmployeeOpt[];
  pending: boolean;
  start: Starter;
  setError: (s: string | null) => void;
  router: ReturnType<typeof useRouter>;
}) {
  const [open, setOpen] = useState(false);
  const [templateId, setTemplateId] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [title, setTitle] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [blankBody, setBlankBody] = useState("");

  const selected = templates.find((t) => t.id === templateId) || null;
  const placeholders = selected ? extractPlaceholders(selected.body) : [];
  const filled = selected ? fillTemplate(selected.body, values) : blankBody;

  function chooseTemplate(id: string) {
    setTemplateId(id);
    const t = templates.find((x) => x.id === id);
    if (!t) {
      setTitle("");
      setValues({});
      return;
    }
    const ph = extractPlaceholders(t.body);
    const init: Record<string, string> = {};
    for (const p of ph) init[p] = "";
    if (ph.includes("дата")) init["дата"] = todayStr();
    const emp = employees.find((e) => e.id === employeeId);
    if (emp && ph.includes("фио")) init["фио"] = emp.name;
    setValues(init);
    setTitle(t.name + (emp ? ` — ${emp.name}` : ""));
  }

  function chooseEmployee(id: string) {
    setEmployeeId(id);
    const emp = employees.find((e) => e.id === id);
    if (selected && emp && extractPlaceholders(selected.body).includes("фио")) {
      setValues((v) => ({ ...v, ["фио"]: emp.name }));
    }
  }

  function reset() {
    setOpen(false);
    setTemplateId("");
    setEmployeeId("");
    setTitle("");
    setValues({});
    setBlankBody("");
  }

  function create() {
    setError(null);
    if (!title.trim()) {
      setError("Укажите название документа");
      return;
    }
    start(async () => {
      const r = await createDocument(projectId, {
        templateId: templateId || null,
        title,
        category: selected?.category ?? "other",
        body: filled,
        employeeId: employeeId || null,
      });
      if (!r.ok) {
        setError(r.error ?? "Ошибка");
        return;
      }
      reset();
      router.refresh();
    });
  }

  return (
    <div>
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mb-5 inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-strong"
        >
          <FilePlus2 className="h-4 w-4" /> Создать документ
        </button>
      ) : (
        <div className="mb-6 rounded-card bg-surface p-6 shadow-soft ring-1 ring-line">
          <h2 className="text-base font-semibold text-ink">Новый документ</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-muted">Шаблон</label>
              <select
                value={templateId}
                onChange={(e) => chooseTemplate(e.target.value)}
                className="mt-1 w-full rounded-xl border border-line bg-canvas px-3 py-2.5 text-sm text-ink focus:border-brand focus:outline-none"
              >
                <option value="">Пустой документ</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted">Сотрудник (необязательно)</label>
              <select
                value={employeeId}
                onChange={(e) => chooseEmployee(e.target.value)}
                className="mt-1 w-full rounded-xl border border-line bg-canvas px-3 py-2.5 text-sm text-ink focus:border-brand focus:outline-none"
              >
                <option value="">—</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-3">
            <label className="text-xs font-medium text-muted">Название документа</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full rounded-xl border border-line bg-canvas px-3 py-2.5 text-sm text-ink focus:border-brand focus:outline-none"
            />
          </div>

          {selected ? (
            placeholders.length > 0 && (
              <div className="mt-4">
                <div className="mb-2 text-xs font-medium text-muted">Заполните поля</div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {placeholders.map((p) => (
                    <div key={p}>
                      <label className="text-xs text-muted">{prettifyPlaceholder(p)}</label>
                      <input
                        value={values[p] ?? ""}
                        onChange={(e) => setValues((v) => ({ ...v, [p]: e.target.value }))}
                        className="mt-1 w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )
          ) : (
            <div className="mt-3">
              <label className="text-xs font-medium text-muted">Текст документа</label>
              <textarea
                value={blankBody}
                onChange={(e) => setBlankBody(e.target.value)}
                rows={8}
                className="mt-1 w-full rounded-xl border border-line bg-canvas px-3 py-2.5 text-sm text-ink focus:border-brand focus:outline-none"
              />
            </div>
          )}

          {filled.trim() && (
            <div className="mt-4">
              <div className="mb-1 text-xs font-medium text-muted">Предпросмотр</div>
              <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-xl bg-canvas p-4 text-sm text-ink ring-1 ring-line">
                {filled}
              </pre>
            </div>
          )}

          <div className="mt-4 flex items-center gap-3">
            <button
              type="button"
              onClick={create}
              disabled={pending}
              className="rounded-xl bg-brand px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-strong disabled:opacity-50"
            >
              Создать документ
            </button>
            <button
              type="button"
              onClick={reset}
              className="rounded-xl border border-line px-3 py-2.5 text-sm text-muted transition hover:bg-canvas"
            >
              Отмена
            </button>
          </div>
        </div>
      )}

      {documents.length === 0 ? (
        <div className="rounded-card border border-dashed border-line bg-surface px-6 py-12 text-center text-sm text-muted">
          Документов пока нет. Нажмите «Создать документ» — выберите шаблон и заполните поля.
        </div>
      ) : (
        <div className="space-y-2.5">
          {documents.map((d) => (
            <div key={d.id} className="rounded-card bg-surface p-4 shadow-soft ring-1 ring-line">
              <div className="flex flex-wrap items-center gap-3">
                <FileText className="h-5 w-5 shrink-0 text-muted" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-ink">{d.title}</div>
                  <div className="text-xs text-muted">
                    {catLabel(d.category)}
                    {d.employeeName ? ` · ${d.employeeName}` : ""} · {formatDateTime(d.created_at)}
                  </div>
                </div>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_TONE[d.status] ?? STATUS_TONE.draft}`}>
                  {STATUS_LABEL[d.status] ?? d.status}
                </span>
                <button
                  type="button"
                  onClick={() => openPrintable(d.title, d.body, false)}
                  title="Печать"
                  className="rounded-lg border border-line bg-canvas p-2 text-muted transition hover:text-ink"
                >
                  <Printer className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => openPrintable(d.title, d.body, true)}
                  title="Скачать (.doc)"
                  className="rounded-lg border border-line bg-canvas p-2 text-muted transition hover:text-ink"
                >
                  <Download className="h-4 w-4" />
                </button>
                <select
                  value={d.status}
                  onChange={(e) =>
                    start(async () => {
                      await updateDocumentStatus(projectId, d.id, e.target.value as "draft" | "signed" | "archived");
                      router.refresh();
                    })
                  }
                  className="rounded-lg border border-line bg-canvas px-2 py-1.5 text-xs text-ink focus:border-brand focus:outline-none"
                >
                  <option value="draft">Черновик</option>
                  <option value="signed">Подписан</option>
                  <option value="archived">Архив</option>
                </select>
                <button
                  type="button"
                  onClick={() =>
                    start(async () => {
                      await deleteDocument(projectId, d.id);
                      router.refresh();
                    })
                  }
                  title="Удалить"
                  className="rounded-lg border border-line p-2 text-muted transition hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- Шаблоны ---------- */

function TemplatesTab({
  projectId,
  templates,
  pending,
  start,
  setError,
  router,
  goGenerate,
}: {
  projectId: string;
  templates: TemplateRow[];
  pending: boolean;
  start: Starter;
  setError: (s: string | null) => void;
  router: ReturnType<typeof useRouter>;
  goGenerate: () => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("hr");
  const [body, setBody] = useState("");

  function startNew() {
    setEditing("new");
    setName("");
    setCategory("hr");
    setBody("");
  }
  function startEdit(t: TemplateRow) {
    setEditing(t.id);
    setName(t.name);
    setCategory(t.category);
    setBody(t.body);
  }
  function save() {
    setError(null);
    if (!name.trim()) {
      setError("Укажите название шаблона");
      return;
    }
    start(async () => {
      const r =
        editing === "new"
          ? await createTemplate(projectId, { name, category, body })
          : await updateTemplate(projectId, editing!, { name, category, body });
      if (!r.ok) {
        setError(r.error ?? "Ошибка");
        return;
      }
      setEditing(null);
      router.refresh();
    });
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={startNew}
          className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-strong"
        >
          <Plus className="h-4 w-4" /> Создать шаблон
        </button>
        {templates.length === 0 && (
          <button
            type="button"
            onClick={() =>
              start(async () => {
                await seedSampleTemplates(projectId);
                router.refresh();
              })
            }
            disabled={pending}
            className="inline-flex items-center gap-2 rounded-xl border border-line bg-canvas px-4 py-2.5 text-sm font-medium text-ink transition hover:bg-surface disabled:opacity-50"
          >
            <Sparkles className="h-4 w-4 text-brand" /> Загрузить шаблоны-примеры
          </button>
        )}
      </div>

      {editing && (
        <div className="mb-6 rounded-card bg-surface p-6 shadow-soft ring-1 ring-line">
          <h2 className="text-base font-semibold text-ink">{editing === "new" ? "Новый шаблон" : "Редактирование шаблона"}</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_200px]">
            <div>
              <label className="text-xs font-medium text-muted">Название</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full rounded-xl border border-line bg-canvas px-3 py-2.5 text-sm text-ink focus:border-brand focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted">Категория</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="mt-1 w-full rounded-xl border border-line bg-canvas px-3 py-2.5 text-sm text-ink focus:border-brand focus:outline-none"
              >
                <option value="hr">Сотрудники</option>
                <option value="client">Клиенты</option>
                <option value="other">Прочее</option>
              </select>
            </div>
          </div>
          <div className="mt-3">
            <label className="text-xs font-medium text-muted">Текст шаблона</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={12}
              className="mt-1 w-full rounded-xl border border-line bg-canvas px-3 py-2.5 font-mono text-[13px] text-ink focus:border-brand focus:outline-none"
            />
            <p className="mt-1 text-xs text-faint">
              Подстановки в двойных скобках, напр. <code>{"{{фио}}"}</code>, <code>{"{{должность}}"}</code> — при создании документа их можно будет заполнить.
            </p>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <button
              type="button"
              onClick={save}
              disabled={pending}
              className="rounded-xl bg-brand px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-strong disabled:opacity-50"
            >
              Сохранить
            </button>
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="rounded-xl border border-line px-3 py-2.5 text-sm text-muted transition hover:bg-canvas"
            >
              Отмена
            </button>
          </div>
        </div>
      )}

      {templates.length === 0 ? (
        <div className="rounded-card border border-dashed border-line bg-surface px-6 py-12 text-center text-sm text-muted">
          Шаблонов пока нет. Нажмите «Загрузить шаблоны-примеры» — добавятся трудовой договор, приказ о приёме, NDA и другие.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {templates.map((t) => (
            <div key={t.id} className="rounded-card bg-surface p-4 shadow-soft ring-1 ring-line">
              <div className="flex items-start gap-3">
                <FileText className="mt-0.5 h-5 w-5 shrink-0 text-muted" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-semibold text-ink">{t.name}</span>
                    {t.is_sample && (
                      <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[11px] text-brand-ink">пример</span>
                    )}
                  </div>
                  <div className="text-xs text-muted">{catLabel(t.category)}</div>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={goGenerate}
                  className="rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-white transition hover:bg-brand-strong"
                >
                  Создать документ
                </button>
                <button
                  type="button"
                  onClick={() => startEdit(t)}
                  className="inline-flex items-center gap-1 rounded-lg border border-line bg-canvas px-2.5 py-1.5 text-xs text-ink transition hover:bg-surface"
                >
                  <Pencil className="h-3.5 w-3.5" /> Изменить
                </button>
                <button
                  type="button"
                  onClick={() =>
                    start(async () => {
                      await deleteTemplate(projectId, t.id);
                      router.refresh();
                    })
                  }
                  className="ml-auto inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-xs text-muted transition hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Удалить
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
