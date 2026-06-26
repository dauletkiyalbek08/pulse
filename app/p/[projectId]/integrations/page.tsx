import { Megaphone, Music2, Database, Send, Sparkles, Lock } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Pill } from "@/components/pill";

const SERVICES = [
  { name: "Meta Ads", desc: "Реклама в Facebook и Instagram", icon: Megaphone },
  { name: "TikTok Ads", desc: "Рекламные кампании TikTok", icon: Music2 },
  { name: "AmoCRM", desc: "Импорт лидов и сделок из внешней CRM", icon: Database },
  { name: "Telegram", desc: "Боты, уведомления, приём чеков", icon: Send },
  { name: "AI-сервисы", desc: "Claude / DeepSeek для контента и креативов", icon: Sparkles },
];

export default function IntegrationsPage() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <PageHeader
        title="Интеграции"
        subtitle="Подключённые сервисы. Каркас — сами подключения добавим по мере готовности."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SERVICES.map((service) => {
          const Icon = service.icon;
          return (
            <div
              key={service.name}
              className="rounded-card bg-surface p-5 shadow-soft ring-1 ring-line"
            >
              <div className="flex items-start justify-between">
                <span className="flex h-11 w-11 items-center justify-center rounded-tile bg-canvas text-muted">
                  <Icon className="h-5 w-5" />
                </span>
                <Pill tone="neutral">Не подключено</Pill>
              </div>
              <h3 className="mt-4 font-semibold text-ink">{service.name}</h3>
              <p className="mt-1 text-sm text-muted">{service.desc}</p>
              <button
                type="button"
                disabled
                className="mt-4 w-full cursor-not-allowed rounded-xl border border-line bg-canvas px-3 py-2 text-sm font-medium text-faint"
              >
                Подключить
              </button>
            </div>
          );
        })}
      </div>

      <div className="mt-6 flex items-start gap-2.5 rounded-card bg-canvas p-4 text-sm text-muted">
        <Lock className="mt-0.5 h-4 w-4 shrink-0" />
        Ключи и токены доступа хранятся только на сервере в зашифрованном виде и
        никогда не передаются в браузер (CLAUDE.md, п. 3.6).
      </div>
    </div>
  );
}
