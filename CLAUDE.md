# Pulse — платформа управления рекламными проектами

> Этот файл — главный контекст проекта. Прочитай его целиком перед началом работы
> и сверяйся с ним на каждом этапе. Если возникает важное архитектурное решение,
> которого нет в этом файле, — сначала спроси, не выбирай молча.

---

## 1. О проекте

**Pulse** — это мульти-проектная платформа (multi-tenant SaaS) для рекламного агентства.
Владелец агентства запускает рекламу для разных клиентов (проектов) и управляет всем из
одного места: видит аналитику, лиды, продажи, финансы и сотрудников по каждому проекту.

Платформа состоит из трёх уровней:

1. **Портал-вход «Мои проекты»** — стартовый экран. Владелец видит карточки всех своих
   проектов (название, ниша, директор, статус) и может создать новый проект одной кнопкой.
2. **Рабочее пространство проекта** — изолированный кабинет одного проекта: дашборд,
   CRM, аналитика, финансы, сотрудники. Каждый проект **полностью независим**.
3. **Роли и доступы** — владелец видит всё; директор проекта заходит по своему логину и
   видит только свой проект; сотрудники (менеджеры, хантеры, учителя) создаются и
   увольняются прямо внутри проекта.

**Бизнес-цель:** сделать удобный рабочий инструмент для себя → показать как готовый
продукт → монетизировать (продать доступ компаниям или продать платформу целиком).

---

## 2. Технический стек

- **Frontend + Backend:** Next.js (App Router) + TypeScript
- **Стили:** Tailwind CSS
- **База данных + Авторизация:** Supabase (PostgreSQL + Supabase Auth, вход по email/паролю)
- **Изоляция данных:** Row Level Security (RLS) на уровне базы — обязательно
- **Деплой:** Vercel
- **Рекламные платформы (позже):** Meta Ads (Facebook/Instagram), TikTok Ads
- **На будущее:** Telegram-боты, генераторы креативов/лендингов, AI Studio

Дизайн: **светлый минимализм** — много воздуха, мягкие тени, скруглённые углы (radius ~16px),
шрифт Inter, акцентный цвет (оранжевый или зелёный — уточнить у владельца). Светлая тема —
основная, тёмная — опционально.

---

## 3. Архитектура и ключевые принципы

Эти принципы важнее любой отдельной функции. Их нельзя нарушать.

### 3.1. Multi-tenant с изоляцией через RLS (КРИТИЧНО, заложить с самого начала)
У каждой таблицы с данными проекта есть колонка `project_id`. Пользователь физически
не может прочитать строки чужого проекта — это гарантируется политиками RLS в Postgres,
а не только проверками в коде. Владелец — над всеми проектами. **Это нужно сделать в
самом начале и правильно; позже переделать будет очень дорого.**

### 3.2. Слой агрегированных метрик (demo → real без переписывания UI)
Дашборд читает цифры **не напрямую из рекламных кабинетов**, а из одной таблицы
`metrics_daily` (метрики по дням на проект). На этапе демо мы наполняем её тестовыми
данными. Позже интеграции Meta/TikTok будут писать в эту же таблицу. **UI при переходе
демо → реальные данные не меняется.**

### 3.3. Шаблоны ниш
У проекта есть тип ниши, и он определяет, какие разделы, метрики и воронку показывать.
На старте две ниши: `education` (образование) и `ecommerce` (товарка). При создании
проекта выбирается ниша → подгружается нужный шаблон. См. раздел 5.

### 3.4. Мягкое удаление + журнал действий
Сотрудников и важные сущности не удаляем физически — помечаем статусом (`fired` + дата).
Так сохраняется история для отчётов и зарплат. Ведём журнал действий (кто создал проект,
кто сменил бюджет, кто кого уволил) — он же добавит доверия при продаже платформы.

### 3.5. Тарифы заложены сразу
У проекта есть поле `plan` (`free` / `trial` / `pro`) с самого начала, даже если оплату
подключим позже. Тогда продажа доступа — это вопрос настроек, а не переделки.

### 3.6. Безопасность токенов
Доступы к рекламным кабинетам (токены API) хранятся **только на сервере**, в зашифрованном
виде, и никогда не передаются в браузер. Реализовать при подключении интеграций.

---

## 4. Роли и доступы

| Роль | Кто это | Что видит |
|------|---------|-----------|
| `owner` | Владелец платформы (один) | Все проекты, может создавать/удалять проекты |
| `director` | Директор проекта (клиент) | Только свой проект, все его разделы и настройки |
| `manager` | Менеджер по продажам | Свой проект: лиды, продажи (объём по настройке) |
| `hunter` | Хантер (квалификация лидов) | Только образование; свои лиды |
| `teacher` | Учитель | Только образование; посещаемость, графики |

Сотрудники создаются внутри проекта (раздел «Настройки» / «Права доступа»). При создании
сотрудника с доступом платформа сама генерирует ему логин и пароль. Увольнение — кнопка,
которая ставит статус `fired`, а не удаляет запись.

---

## 5. Типы проектов (ниши)

Две ниши различаются метриками, разделами и воронкой. Это ядро продукта.

### 5.1. Образование (`education`)
**Воронка:** Лид → Пробный урок → Продажа курса.

**Метрики дашборда:** Доход, Расходы, Чистая прибыль, Лиды, Цена лида, Пробные уроки,
Продажи курса, Конверсия.

**Разделы меню:**
- *Обзор:* Главная (дашборд)
- *Продажи и CRM:* Лиды, CRM-воронка, Пробные уроки, Продажи, Клиенты, Анализ звонков,
  Hunter-кабинет, Менеджеры/Учителя
- *Маркетинг:* Реклама, Аналитика креативов, Marketing Dashboard, SMM Studio, CAPI,
  Ресурсы/Воронки, AI Studio
- *Автоматизация:* ChatBot Builder, Интеграции
- *Финансы и HR:* Финансы, Зарплаты, Посещаемость, Графики работы, Договоры
- *Система:* Отчёты, Настройки, Права доступа

**Особенности:** есть роль `hunter`; блоки «Топ хантеров» и «Топ менеджеров» на дашборде.

### 5.2. Товарка / e-commerce (`ecommerce`)
Референс — парфюмерный бизнес. **Воронка:** Лид → Обработан → Продажа.

**Метрики дашборда:** Всего лидов, Новые сегодня, Продажи, Выручка, Расход (TikTok),
Цена лида, Конверсия, Валовая прибыль, ROAS/ROI. Плюс блок склада: Товаров в каталоге,
Единиц на складе, Заканчиваются, Себестоимость склада.

**Разделы меню:** Главная, Лиды, Продажи, Менеджеры, **Товары (склад)**, TikTok-аналитика,
Отчёты, Настройки.

**Особенности:** нет роли `hunter` (только `manager`); есть **складской учёт** (таблица
`products`); есть блок «Живая сводка дня» (AI-подсказка — пока статичный текст-заглушка).

---

## 6. Схема базы данных

SQL для Supabase. Идентификаторы таблиц/колонок — на английском. Применять как миграции.

```sql
-- Профили (расширяют auth.users). Любой, у кого есть логин.
create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null,
  global_role text not null default 'director'  -- 'owner' | 'director' | 'manager' | 'hunter' | 'teacher'
                check (global_role in ('owner','director','manager','hunter','teacher')),
  created_at  timestamptz not null default now()
);

-- Проекты
create table projects (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references profiles(id),
  name          text not null,
  niche         text not null check (niche in ('education','ecommerce')),
  director_name text,
  description   text,
  status        text not null default 'active' check (status in ('active','paused','completed')),
  plan          text not null default 'trial'  check (plan in ('free','trial','pro')),
  icon          text,                 -- ключ иконки для карточки
  accent_color  text,                 -- цвет иконки на карточке
  created_at    timestamptz not null default now()
);

-- Участники проекта (управляет доступом: кто и с какой ролью внутри проекта)
create table project_members (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  user_id    uuid not null references profiles(id) on delete cascade,
  role       text not null check (role in ('director','manager','hunter','teacher')),
  status     text not null default 'active' check (status in ('active','fired')),
  hired_at   timestamptz not null default now(),
  fired_at   timestamptz,
  unique (project_id, user_id)
);

-- Агрегированные метрики по дням (источник цифр для дашборда)
create table metrics_daily (
  id             uuid primary key default gen_random_uuid(),
  project_id     uuid not null references projects(id) on delete cascade,
  date           date not null,
  leads          int not null default 0,
  qualified      int not null default 0,   -- «качественные» (education) / «обработаны» (ecommerce)
  trial_lessons  int not null default 0,   -- только education
  sales          int not null default 0,
  revenue        numeric not null default 0,
  ad_spend       numeric not null default 0,
  unique (project_id, date)
);
-- Производные метрики считаются в приложении:
-- net_profit = revenue - ad_spend; cost_per_lead = ad_spend / leads;
-- conversion = sales / leads; roas = revenue / ad_spend.

-- Лиды (CRM)
create table leads (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references projects(id) on delete cascade,
  full_name   text not null,
  phone       text,
  source      text,                  -- 'meta' | 'tiktok' | 'other'
  status      text not null default 'new',  -- education: new|qualified|trial|sale; ecommerce: new|processed|sale
  assigned_to uuid references profiles(id),
  value       numeric default 0,     -- предполагаемая сумма сделки
  created_at  timestamptz not null default now()
);

-- Продажи
create table sales (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references projects(id) on delete cascade,
  lead_id     uuid references leads(id),
  manager_id  uuid references profiles(id),
  product     text,                  -- название курса/товара
  amount      numeric not null default 0,
  created_at  timestamptz not null default now()
);

-- Товары / склад (только ecommerce)
create table products (
  id             uuid primary key default gen_random_uuid(),
  project_id     uuid not null references projects(id) on delete cascade,
  name           text not null,
  sku            text,
  stock_quantity int not null default 0,
  cost_price     numeric not null default 0,
  sale_price     numeric not null default 0,
  low_stock_threshold int not null default 5,
  created_at     timestamptz not null default now()
);

-- Журнал действий
create table activity_log (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid references projects(id) on delete cascade,
  actor_id    uuid references profiles(id),
  action      text not null,         -- 'project.created' | 'member.fired' | ...
  details     jsonb,
  created_at  timestamptz not null default now()
);
```

> HR-таблицы (зарплаты, посещаемость, графики, договоры) добавим на соответствующем этапе.
> Сейчас в схему их не включаем, чтобы не усложнять MVP.

---

## 7. RLS — изоляция проектов

Включить RLS на **всех** таблицах с `project_id`. Базовый паттерн: владелец видит всё,
участник — только свои проекты.

```sql
-- Вспомогательные функции
create or replace function is_owner() returns boolean
language sql security definer stable as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and global_role = 'owner'
  );
$$;

create or replace function is_project_member(pid uuid) returns boolean
language sql security definer stable as $$
  select exists (
    select 1 from project_members
    where project_id = pid and user_id = auth.uid() and status = 'active'
  );
$$;

-- Включаем RLS
alter table projects        enable row level security;
alter table project_members enable row level security;
alter table metrics_daily   enable row level security;
alter table leads           enable row level security;
alter table sales           enable row level security;
alter table products        enable row level security;
alter table activity_log    enable row level security;

-- projects: владелец видит свои; участник видит проекты, где состоит
create policy projects_owner on projects for all
  using (owner_id = auth.uid() or is_owner());
create policy projects_member_read on projects for select
  using (is_project_member(id));

-- Шаблон для таблиц с project_id (повторить для metrics_daily, leads, sales, products, activity_log):
create policy metrics_owner on metrics_daily for all
  using (is_owner());
create policy metrics_member on metrics_daily for select
  using (is_project_member(project_id));
-- (аналогично создать политики *_owner / *_member для leads, sales, products, activity_log)

-- project_members: владелец управляет; участник видит состав своего проекта
create policy members_owner on project_members for all using (is_owner());
create policy members_read  on project_members for select using (is_project_member(project_id));
```

> Запись в данные проекта менеджерами/директорами разрешаем точечно политиками `for insert`/
> `for update` по мере появления соответствующих экранов. На этапе демо данные пишет владелец.

---

## 8. Структура страниц (роутинг)

```
/login                         — вход (email + пароль)
/                              — «Мои проекты»: карточки + «Создать проект»
/projects/new                  — создание проекта (выбор ниши, название, директор)
/p/[projectId]                 — Главная (дашборд) проекта
/p/[projectId]/leads           — Лиды
/p/[projectId]/sales           — Продажи
/p/[projectId]/funnel          — CRM-воронка (education)
/p/[projectId]/products        — Товары/склад (ecommerce)
/p/[projectId]/finance         — Финансы
/p/[projectId]/team            — Менеджеры/Учителя, Hunter-кабинет
/p/[projectId]/settings        — Настройки + Права доступа (создание/увольнение сотрудников)
... остальные разделы из раздела 5 — пока заглушки «Раздел в разработке»
```

Боковое меню рендерится **по нише** проекта (см. раздел 5): для `education` — один набор
пунктов, для `ecommerce` — другой. Пункты, до которых ещё не дошли, ведут на страницу-
заглушку, но присутствуют в меню.

---

## 9. Демо-данные

Один seed-скрипт наполняет первый проект (ниша `education`) тестовыми данными:
- 1 проект «Английский курс», директор, план `trial`, статус `active`;
- ~30 строк `metrics_daily` за последний месяц (плавные графики дохода/расходов, как на
  референсе): доход 150–200 тыс, расходы ~100 тыс, лиды/пробные/продажи небольшими числами;
- 10–15 лидов с разными статусами и источниками;
- несколько продаж и несколько сотрудников (менеджеры + хантеры) для блоков «Топ…».

Данные должны выглядеть реалистично и совпадать по смыслу с дашбордом из раздела 5.1.

---

## 10. Этапы сборки

Делать строго по порядку. Не переходить к следующему этапу, не завершив текущий.

**Этап 1 — Каркас и портал (начинаем с него):**
1. Инициализировать Next.js (App Router) + TypeScript + Tailwind, подключить Supabase.
2. Применить схему БД (раздел 6) и RLS (раздел 7) как миграции.
3. Авторизация по email/паролю; завести владельца.
4. Страница «Мои проекты» (карточки + «Создать проект») по дизайну из Claude Design.
5. Создание проекта `/projects/new` (выбор ниши, название, директор) — пишет в `projects`.

**Этап 2 — Дашборд проекта (education) на демо-данных:**
1. Seed-скрипт демо-данных (раздел 9).
2. Дашборд `/p/[projectId]`: карточки метрик, график «Динамика дохода», воронка,
   «Топ хантеров/менеджеров» — всё из `metrics_daily` и связанных таблиц.
3. Боковое меню по нише; разделы без реализации — заглушки.

**Этап 3 — Лиды и продажи (CRM-минимум):**
1. `/p/[projectId]/leads` — таблица лидов со статусами и источником.
2. `/p/[projectId]/sales` — список продаж.

**Этап 4 — Второй проект (ecommerce):**
1. Шаблон ниши `ecommerce`: свои метрики, меню, воронка.
2. Раздел «Товары/склад» (`products`) + складские метрики на дашборде.

**Этап 5 — Сотрудники и доступы:**
1. Создание сотрудника с генерацией логина/пароля; роли внутри проекта.
2. Увольнение (мягкое, статус `fired`); запись в `activity_log`.

**Этап 6 — Реальные интеграции и автоматизация (позже):**
Meta Ads и TikTok Ads (пишут в `metrics_daily`), Telegram-боты, генераторы, AI Studio,
тарифы/оплата.

---

## 11. Соглашения по коду

- TypeScript строго; осмысленные имена; без «магических чисел».
- Серверная логика и доступ к Supabase — на сервере (Server Components / Route Handlers).
  Секретные ключи и токены **никогда** не попадают в клиентский бандл.
- Производные метрики (прибыль, ROAS, конверсия, цена лида) считаются в одном месте
  (утилита/хелпер), а не дублируются по компонентам.
- UI-компоненты переиспользуемые (карточка метрики, карточка проекта, таблица) и
  параметризуются под нишу, а не копируются.
- Все суммы и даты форматируются централизованно (валюта — тенге `₸` на референсах,
  сделать настраиваемой на уровне проекта).
- Коммиты небольшие и осмысленные; после каждого этапа — рабочее состояние, готовое к
  деплою на Vercel.

---

## 12. Что НЕ делаем сейчас (вне области MVP)

Чтобы не распыляться, на старте **не** реализуем глубоко (оставляем заглушки/на потом):
генераторы креативов и лендингов, AI Studio, ChatBot Builder, реальные интеграции Meta/
TikTok, CAPI, договоры/посещаемость/графики, оплату тарифов, поддомены для проектов.
Место в архитектуре под них оставлено — подключим на Этапе 6 и далее.
