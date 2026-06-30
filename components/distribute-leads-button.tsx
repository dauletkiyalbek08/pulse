"use client";

import { useState, useTransition } from "react";
import { Loader2, Share2 } from "lucide-react";
import { distributeUnassignedLeads } from "@/app/p/[projectId]/leads/actions";

/**
 * Кнопка РОПа: раздать «зависшие» лиды (без хантера) по кругу команде.
 * Видна руководству; count — сколько сейчас лидов без ответственного.
 */
export function DistributeLeadsButton({
  projectId,
  count,
}: {
  projectId: string;
  count: number;
}) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function run() {
    setMsg(null);
    start(async () => {
      const r = await distributeUnassignedLeads(projectId);
      if (!r.ok) setMsg(r.error ?? "Ошибка");
      else setMsg(r.assigned > 0 ? `Роздано хантерам: ${r.assigned}` : "Свободных лидов нет");
    });
  }

  if (count === 0 && !msg) return null;

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={run}
        disabled={pending || count === 0}
        className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-3.5 py-2 text-sm font-medium text-white transition hover:bg-brand-strong disabled:opacity-50"
        title="Раздать лиды без ответственного хантерам по очереди"
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
        Раздать новые{count > 0 ? ` (${count})` : ""}
      </button>
      {msg && <span className="text-xs text-muted">{msg}</span>}
    </div>
  );
}
