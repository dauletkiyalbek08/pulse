"use client";

import { LogOut } from "lucide-react";
import { fireEmployee } from "@/app/p/[projectId]/settings/actions";

export function FireMemberForm({
  projectId,
  memberId,
  name,
}: {
  projectId: string;
  memberId: string;
  name: string;
}) {
  const action = fireEmployee.bind(null, projectId);
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (
          !window.confirm(
            `Уволить сотрудника «${name}»? Доступ к проекту будет закрыт, запись сохранится в истории.`,
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="member_id" value={memberId} />
      <button
        type="submit"
        className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted transition hover:bg-red-50 hover:text-red-600"
      >
        <LogOut className="h-3.5 w-3.5" />
        Уволить
      </button>
    </form>
  );
}
