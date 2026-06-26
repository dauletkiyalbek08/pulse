import { Activity } from "lucide-react";

export function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand text-white shadow-soft">
        <Activity className="h-5 w-5" strokeWidth={2.5} />
      </span>
      <span className="text-lg font-bold tracking-tight text-ink">Pulse</span>
    </div>
  );
}
