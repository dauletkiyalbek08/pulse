"use client";

import { useState, useTransition } from "react";
import { Send, Loader2, Copy, Check } from "lucide-react";
import { genTelegramLink } from "@/app/p/[projectId]/settings/actions";
import { roleLabel } from "@/lib/members";
import { Avatar } from "@/components/avatar";
import { Pill } from "@/components/pill";

export interface TgMember {
  userId: string;
  name: string;
  role: string;
  linked: boolean;
}

export function TelegramConnect({
  projectId,
  members,
}: {
  projectId: string;
  members: TgMember[];
}) {
  const [pending, startTransition] = useTransition();
  const [links, setLinks] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState<string | null>(null);
  const [active, setActive] = useState<string | null>(null);

  function connect(userId: string) {
    setActive(userId);
    startTransition(async () => {
      const res = await genTelegramLink(projectId, userId);
      if (res.ok && res.url) setLinks((l) => ({ ...l, [userId]: res.url! }));
    });
  }

  async function copy(userId: string, url: string) {
    await navigator.clipboard.writeText(url);
    setCopied(userId);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <ul className="divide-y divide-line rounded-card bg-surface shadow-soft ring-1 ring-line">
      {members.map((m) => {
        const url = links[m.userId];
        return (
          <li key={m.userId} className="px-5 py-3">
            <div className="flex items-center gap-3">
              <Avatar name={m.name} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium text-ink">{m.name}</div>
                <div className="text-xs text-muted">{roleLabel(m.role)}</div>
              </div>
              {m.linked ? (
                <Pill tone="success">Подключён</Pill>
              ) : (
                <button
                  type="button"
                  onClick={() => connect(m.userId)}
                  disabled={pending && active === m.userId}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-ink transition hover:bg-canvas disabled:opacity-60"
                >
                  {pending && active === m.userId ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  Подключить
                </button>
              )}
            </div>

            {url && (
              <div className="mt-2 flex items-center gap-2 rounded-lg bg-canvas p-2 text-xs">
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-w-0 flex-1 truncate font-mono text-brand-ink hover:underline"
                >
                  {url}
                </a>
                <button
                  type="button"
                  onClick={() => copy(m.userId, url)}
                  className="inline-flex items-center gap-1 rounded-md border border-line bg-surface px-2 py-1 text-muted transition hover:text-ink"
                >
                  {copied === m.userId ? (
                    <Check className="h-3.5 w-3.5 text-brand" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
