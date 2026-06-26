# Pulse

Мульти-проектная платформа (multi-tenant SaaS) для рекламного агентства: портал
«Мои проекты», изолированные рабочие пространства проектов, роли и доступы.
Полное техническое задание — в [CLAUDE.md](./CLAUDE.md).

## Стек

- **Next.js 16** (App Router) + **TypeScript**
- **Tailwind CSS v4** (дизайн-токены в `app/globals.css`), шрифт **Inter**
- **Supabase** (PostgreSQL + Auth, вход по email/паролю)
- Изоляция данных проектов — **Row Level Security** на уровне БД
- Деплой — **Vercel**

## Структура

```
app/
  layout.tsx              # корневой layout (Inter, тема)
  page.tsx                # «Мои проекты» (портал)
  login/                  # вход по email/паролю
  projects/new/           # создание проекта
  p/[projectId]/          # рабочее пространство проекта (Этап 2 — заглушка)
  actions.ts              # общие server actions (выход)
components/               # переиспользуемые UI-компоненты
lib/
  supabase/               # клиенты Supabase (server, client) + proxy-сессия
  niches.ts               # шаблоны ниш (education / ecommerce)
  projects.ts             # статусы/тарифы проекта
  metrics.ts              # расчёт производных метрик (одно место)
  format.ts               # форматирование сумм, чисел, дат
proxy.ts                  # обновление сессии + защита маршрутов
```

## Локальный запуск

1. Установить зависимости:
   ```bash
   npm install
   ```
2. Создать `.env.local` по образцу `.env.example` и заполнить ключами Supabase
   (Project Settings → API):
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_xxx
   ```
3. Запустить:
   ```bash
   npm run dev
   ```
   Открыть http://localhost:3000 — произойдёт редирект на `/login`.

## База данных

Схема и RLS применены как миграции Supabase:

- `01_schema` — таблицы (раздел 6 ТЗ) + триггер авто-создания `profiles`
  при регистрации в Supabase Auth.
- `02_rls_policies` — функции `is_owner()` / `is_project_member()`, RLS на всех
  таблицах, политики «владелец видит всё / участник — только свой проект»
  (раздел 7 ТЗ).

## Деплой на Vercel

1. Импортировать репозиторий в Vercel (framework определится автоматически).
2. Добавить переменные окружения `NEXT_PUBLIC_SUPABASE_URL` и
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
3. Deploy.

## Этапы

Сборка идёт по этапам из CLAUDE.md (раздел 10). Сейчас завершён **Этап 1**:
каркас, авторизация, портал «Мои проекты», создание проекта, изоляция через RLS.
