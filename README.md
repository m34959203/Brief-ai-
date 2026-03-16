<p align="center">
  <strong>Brief AI</strong> — AI-ассистент для генерации технических заданий
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-14.2-black" alt="Next.js" />
  <img src="https://img.shields.io/badge/TypeScript-5.5-blue" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Claude_API-Sonnet_4-blueviolet" alt="Claude" />
  <img src="https://img.shields.io/badge/License-MIT-green" alt="License" />
</p>

---

## Что это

Brief AI заменяет роль **Product Owner** и **бизнес-аналитика** на этапе создания ТЗ. AI проводит пользователя через 6-шаговый визард, задаёт уточняющие вопросы, ловит противоречия и генерирует структурированное техническое задание с User Stories, NFR и планом реализации.

**Ключевое отличие от ChatGPT:** AI не принимает первый ответ — всегда уточняет, предлагает варианты и проверяет согласованность.

## Возможности

- 6-шаговый визард с AI-диалогом (суть → задачи → пользователи → фичи → NFR → реализация)
- Автоматическая проверка противоречий после шагов 4 и 6
- Каталог фичей по типу проекта (ecommerce, landing, CRM, mobile, bot)
- MoSCoW-приоритизация с проверкой зависимостей
- Генерация ТЗ в 7 разделах + экспорт Markdown/PDF
- Демо-режим — шаг 1 без регистрации
- Мобильный адаптив (от 375px)

## Быстрый старт

### Требования

- Node.js 18+
- Docker и Docker Compose (для PostgreSQL и Redis)
- API-ключ [Anthropic](https://console.anthropic.com/)

### Установка

```bash
# 1. Клонирование
git clone https://github.com/m34959203/Brief-ai-.git
cd Brief-ai-

# 2. Зависимости
npm install

# 3. Окружение
cp .env.example .env
# Отредактируйте .env — укажите ANTHROPIC_API_KEY

# 4. Инфраструктура
docker compose up -d

# 5. База данных
npm run db:migrate
npm run db:seed

# 6. Запуск
npm run dev
```

Приложение доступно на [http://localhost:3000](http://localhost:3000).

### Скрипты

| Команда | Описание |
|---------|----------|
| `npm run dev` | Запуск dev-сервера (порт 3000) |
| `npm run build` | Production-сборка |
| `npm run start` | Запуск production-сервера |
| `npm run lint` | Линтинг (ESLint + Next.js) |
| `npm run db:migrate` | Применение миграций PostgreSQL |
| `npm run db:seed` | Загрузка FeatureCatalog (5 типов, 44 фичи) |
| `npm run db:reset` | Полный сброс: миграции + seed |
| `npm run test:ai-eval` | Прогон AI-сценариев (15 тестов, порог >= 4.0) |

## Структура проекта

```
Brief-ai-/
├── prisma/
│   └── schema.sql                  # Схема БД — 9 таблиц
├── scripts/
│   ├── migrate.ts                  # Скрипт миграции
│   └── seed.ts                     # Загрузка FeatureCatalog
├── seed/
│   └── feature-catalog.ts          # 5 типов × 8-15 фичей с зависимостями
├── src/
│   ├── app/
│   │   ├── page.tsx                # Лендинг
│   │   ├── layout.tsx              # Root layout (Tailwind)
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx      # Вход
│   │   │   └── register/page.tsx   # Регистрация
│   │   ├── dashboard/page.tsx      # Список проектов
│   │   ├── wizard/
│   │   │   ├── demo/page.tsx       # Демо-режим (без auth)
│   │   │   └── [sessionId]/page.tsx # Wizard-сессия
│   │   ├── documents/
│   │   │   └── [id]/page.tsx       # Превью и редактирование ТЗ
│   │   └── api/                    # REST API (см. docs/API.md)
│   │       ├── auth/               # Регистрация, вход, выход
│   │       ├── wizard/sessions/    # CRUD wizard-сессий и шагов
│   │       ├── documents/          # Экспорт и редактирование ТЗ
│   │       └── analytics/          # Запись событий
│   ├── components/
│   │   ├── ui/                     # Дизайн-система (shadcn + кастомные)
│   │   └── wizard/Wizard.tsx       # Главный UI-компонент визарда
│   ├── lib/
│   │   ├── ai/
│   │   │   ├── ai-service.ts       # Claude API: стриминг, retry, суммаризация
│   │   │   └── prompts.ts          # 8 промптов (6 шагов + противоречия + генерация)
│   │   ├── analytics/tracker.ts    # 14 аналитических событий
│   │   ├── auth/                   # JWT: Argon2id, access/refresh токены
│   │   ├── db/
│   │   │   ├── index.ts            # PostgreSQL пул + Redis-клиент
│   │   │   └── repositories/       # 7 CRUD-репозиториев
│   │   ├── document/
│   │   │   ├── generator.ts        # Сбор данных → AI-генерация ТЗ
│   │   │   └── exporter.ts         # Экспорт: Markdown + HTML/PDF
│   │   └── engine/
│   │       ├── wizard-config.ts    # Конфигурация 6 шагов
│   │       └── wizard-engine.ts    # Движок: сессии, шаги, кэш Redis
│   └── middleware.ts               # JWT-проверка, защита маршрутов
├── tests/
│   └── ai-eval/                    # AI-тестирование (15 сценариев)
├── docker-compose.yml              # PostgreSQL 16 + Redis 7
├── tailwind.config.ts              # Палитра: primary, accent, success, warning, error
└── tsconfig.json                   # TypeScript strict mode
```

## Технологии

| Слой | Технология | Зачем |
|------|-----------|-------|
| **Frontend** | Next.js 14 (App Router) | SSR, API routes, файловый роутинг |
| **UI** | Tailwind CSS + shadcn/ui | Быстрая стилизация, accessible-компоненты |
| **AI** | Claude Sonnet 4 (@anthropic-ai/sdk) | Диалог, генерация, проверка противоречий |
| **БД** | PostgreSQL 16 | Основное хранилище (9 таблиц, JSONB) |
| **Кэш** | Redis 7 | Состояние сессий (TTL 1 час), rate limiting |
| **Аутентификация** | JWT (jose + Argon2id) | Stateless auth, access 15мин + refresh 7 дней |
| **Валидация** | Zod | Типобезопасная валидация API-запросов |
| **Язык** | TypeScript 5.5 (strict) | Сквозная типизация |

## Архитектура

Подробное описание — в [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (Next.js 14)                     │
│   Лендинг · Wizard UI · Дашборд · Превью ТЗ · Экспорт      │
└──────────────────────────┬──────────────────────────────────┘
                           │ fetch / SSE
┌──────────────────────────▼──────────────────────────────────┐
│                  API Layer (App Router)                      │
│   Middleware (JWT) → Zod-валидация → Rate Limiting (Redis)   │
└───────┬───────────────┬─────────────────┬───────────────────┘
        │               │                 │
   ┌────▼─────┐   ┌─────▼──────┐   ┌─────▼──────┐
   │  Wizard   │   │ AI Service │   │  Document  │
   │  Engine   │   │ (Claude)   │   │  Service   │
   │ 6 шагов   │   │ Стриминг   │   │ MD + PDF   │
   └────┬──────┘   │ Retry      │   └────────────┘
        │          │ Summarize  │
   ┌────▼──────────▼────────────▼─────────────────┐
   │              Data Layer                       │
   │   PostgreSQL (9 таблиц) + Redis (кэш/TTL)    │
   └──────────────────────────────────────────────┘
```

## API

Полная документация — в [docs/API.md](docs/API.md).

Ключевые эндпоинты:

| Метод | Путь | Описание |
|-------|------|----------|
| `POST` | `/api/auth/register` | Регистрация |
| `POST` | `/api/auth/login` | Вход |
| `POST` | `/api/wizard/sessions` | Создание wizard-сессии |
| `GET` | `/api/wizard/sessions/:id` | Состояние сессии |
| `PUT` | `/api/wizard/sessions/:id/steps/:step` | Отправка ответа на шаг |
| `POST` | `/api/wizard/sessions/:id/override` | Игнорирование предупреждения |
| `POST` | `/api/wizard/sessions/:id/generate` | Генерация ТЗ |
| `GET` | `/api/documents/:id/export/:format` | Экспорт (md/pdf) |

## Себестоимость сессии

| Компонент | Текстовый режим | Голос (фаза 2) |
|-----------|-----------------|----------------|
| Claude API | $0.40–0.70 | $0.40–0.70 |
| STT | — | $0.10–0.30 |
| TTS | — | $0.05–0.15 |
| **Итого** | **$0.42–0.72** | **$0.55–1.18** |

## Документация

| Документ | Описание |
|----------|----------|
| [README.md](README.md) | Обзор проекта, быстрый старт |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Архитектура, паттерны, схема данных |
| [docs/API.md](docs/API.md) | Документация REST API |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Гайд для разработчиков |
| [AGENTS.md](AGENTS.md) | План реализации для AI-агентов (16 задач) |

## Лицензия

MIT
