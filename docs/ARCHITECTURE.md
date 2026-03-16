# Архитектура Brief AI

## Обзор

Brief AI — монолитное Next.js-приложение с серверными API-роутами, Claude API для AI-диалогов и PostgreSQL + Redis для хранения данных.

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React 18)                       │
│                                                             │
│  Лендинг    Wizard UI     Дашборд    Превью ТЗ   Auth      │
│  /          /wizard/:id   /dashboard /documents/:id /login  │
└──────────────────────────┬──────────────────────────────────┘
                           │
                    fetch / SSE
                           │
┌──────────────────────────▼──────────────────────────────────┐
│               Middleware (src/middleware.ts)                  │
│         JWT-проверка · Защита маршрутов · Rate Limit         │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                  API Layer (App Router)                       │
│                                                              │
│  /api/auth/*          /api/wizard/sessions/*                 │
│  /api/documents/*     /api/analytics                         │
│                                                              │
│  Zod-валидация → Бизнес-логика → JSON-ответ                  │
└───────┬───────────────┬─────────────────┬───────────────────┘
        │               │                 │
   ┌────▼─────┐   ┌─────▼──────┐   ┌─────▼──────┐
   │  Wizard   │   │ AI Service │   │  Document  │
   │  Engine   │   │            │   │  Service   │
   └────┬──────┘   └─────┬──────┘   └─────┬──────┘
        │                │                 │
   ┌────▼────────────────▼─────────────────▼──────┐
   │              Data Layer                       │
   │                                               │
   │   PostgreSQL 16          Redis 7              │
   │   ├── users              ├── session:{id}     │
   │   ├── projects           │   (TTL 1 час)      │
   │   ├── wizard_sessions    └── rate:{ip}        │
   │   ├── wizard_steps           (TTL 1 мин)      │
   │   ├── brief_documents                         │
   │   ├── templates                               │
   │   ├── feature_catalogs                        │
   │   ├── voice_transcripts                       │
   │   └── analytics_events                        │
   └──────────────────────────────────────────────┘
```

---

## Ключевые компоненты

### Wizard Engine (`src/lib/engine/`)

Движок 6-шагового визарда. Управляет жизненным циклом сессии.

**Основные методы:**
- `startSession(userId, briefType)` — создаёт project + session + 6 steps
- `getSessionState(sessionId)` — из Redis-кэша или fallback на PostgreSQL
- `processStep(sessionId, step, answer)` — вызывает AI, обновляет данные
- `overrideWarning(sessionId, warningId)` — записывает в user_overrides

**Конфигурация шагов** (`wizard-config.ts`):

| Шаг | ID | AI-роль | Промпт | Валидация |
|-----|----|---------|--------|-----------|
| 1 | `step1_scope` | Product Owner | STEP1_SCOPE | project_type обязателен |
| 2 | `step2_tasks` | Product Owner | STEP2_TASKS | min 3 задачи |
| 3 | `step3_users` | Аналитик | STEP3_USERS | min 2 роли |
| 4 | `step4_features` | PO + Аналитик | STEP4_FEATURES | min 5 фичей |
| 5 | `step5_nfr` | Аналитик | STEP5_NFR | min 3 NFR |
| 6 | `step6_implementation` | Аналитик | STEP6_IMPLEMENTATION | min 1 constraint |

**Жизненный цикл шага:**

```
Пользователь вводит ответ
    │
    ▼
processStep()
    │
    ├─ Заполняет промпт (template + context + facts)
    ├─ Вызывает Claude API
    ├─ Парсит JSON-ответ
    ├─ Мержит structured_facts (массивы — union, не replace)
    ├─ Обновляет wizard_steps в PostgreSQL
    ├─ Обновляет кэш в Redis
    │
    ├─ step_complete = false → возврат AI-ответа (уточняющий вопрос)
    │
    └─ step_complete = true
       ├─ Суммаризация context_summary (Claude)
       ├─ Проверка противоречий (после шагов 4, 6)
       └─ Переход к следующему шагу
```

---

### AI Service (`src/lib/ai/`)

Интеграция с Claude API. Поддерживает стриминг, retry и суммаризацию.

**Архитектура промптов:**

Каждый шаг имеет **отдельный промпт** (не один на всю сессию). Промпт состоит из 5 частей:

1. **Роль** — Product Owner или бизнес-аналитик
2. **Контекст** — `{{context_summary}}` из предыдущих шагов
3. **Инструкция** — конкретное задание для шага
4. **Формат** — JSON-структура ответа
5. **Примеры** — хороший и плохой диалог

**Формат ответа AI (JSON):**

```json
{
  "message": "Текст для пользователя",
  "extracted_data": { },
  "updated_facts": { },
  "contradictions": [{ "description": "...", "severity": "warning|critical" }],
  "step_complete": false,
  "open_questions": []
}
```

**Retry-стратегия:**
- 429 (rate limit) и 529 (overloaded) → exponential backoff (1с, 2с, 4с)
- Максимум 3 попытки
- Таймаут 30 секунд на вызов

**Модель:** Claude Sonnet 4 (`claude-sonnet-4-20250514`)

---

### Управление состоянием

Brief AI использует **трёхслойное хранение** состояния:

| Слой | Что хранит | Где | TTL |
|------|-----------|-----|-----|
| `structured_facts` | Критичные данные (project_type, must_features, has_payments...) | PostgreSQL (JSONB) | — |
| `context_summary` | Сжатый контекст предыдущих шагов (500–1000 токенов) | PostgreSQL (text) | — |
| Redis-кэш | Полное состояние сессии + история диалогов | Redis | 1 час |

**Правило:** `structured_facts` **никогда не теряются**. При обновлении массивы мержатся (union), а не заменяются.

```typescript
// Пример мержа (wizard-engine.ts)
must_features: Array.from(new Set([
  ...state.structured_facts.must_features,
  ...(aiResponse.updated_facts.must_features || []),
]))
```

---

### FeatureCatalog

Каталог типовых фичей по типу проекта. Хранится в PostgreSQL (`feature_catalogs`), загружается seed-скриптом.

**5 типов проектов:**

| Тип | Фичей | Типовые роли |
|-----|-------|-------------|
| ecommerce | 13 | покупатель, гость, администратор, модератор |
| landing | 9 | посетитель, администратор |
| crm | 7 | менеджер, руководитель, администратор |
| mobile | 8 | пользователь, администратор |
| bot | 7 | пользователь, администратор |

**Каждая фича содержит:**
- Название и описание
- Зависимости (`depends_on: ["auth", "cart"]`)
- NFR-импликации
- Приоритет (must / should / could)

Каталог используется на шагах 3 (роли) и 4 (фичи) визарда.

---

### Аутентификация (`src/lib/auth/`)

JWT-аутентификация без NextAuth (кастомная реализация).

- **Хэширование:** Argon2id (не bcrypt)
- **Access token:** 15 минут, httpOnly-куки
- **Refresh token:** 7 дней, httpOnly-куки
- **Middleware:** проверка JWT на защищённых маршрутах
- **Демо-режим:** `POST /api/wizard/sessions` и шаг 1 доступны без auth

---

### Генерация документа (`src/lib/document/`)

Двухэтапный процесс:

1. **generator.ts** — собирает `extracted_data` со всех шагов, вызывает Claude для генерации 7 разделов
2. **exporter.ts** — конвертирует в Markdown или HTML (для печати в PDF)

**7 разделов ТЗ:**

1. Проблема
2. Цель проекта
3. Основные задачи
4. Функциональные требования (User Stories)
5. Нефункциональные требования (с обоснованиями)
6. Эффекты проекта (с метриками)
7. Требования к реализации

**Дополнительные блоки:**
- Открытые вопросы (из `open_questions` всех шагов)
- Проигнорированные предупреждения (из `user_overrides`)
- Полнота (`completeness_score` = заполненные разделы / 7 × 100)

---

## Схема базы данных

9 таблиц в PostgreSQL. Схема — `prisma/schema.sql`.

```
users
  ├── projects (1:N)
  │    ├── wizard_sessions (1:1)
  │    │    └── wizard_steps (1:6)
  │    └── brief_documents (1:1)
  └── analytics_events (1:N)

templates (standalone)
feature_catalogs (standalone)
voice_transcripts (1:1 with wizard_steps, фаза 2)
```

**Ключевые JSONB-поля:**
- `wizard_sessions.structured_facts` — критичные данные проекта
- `wizard_steps.extracted_data` — данные шага (от AI)
- `wizard_steps.user_answers` — история диалога шага
- `brief_documents.sections` — 7 разделов ТЗ
- `feature_catalogs.features` — каталог фичей + роли

---

## Проверка противоречий

Запускается автоматически после шагов 4 и 6. Отдельный вызов Claude с промптом `CONTRADICTION_CHECK`.

**Что проверяется:**
1. Конфликты между фичами
2. Пропущенные зависимости (оплата без авторизации)
3. Нереалистичные требования (бюджет vs объём)
4. Несогласованности между разделами

**Severity:**
- `warning` — можно продолжить, отображается жёлтая карточка
- `critical` — рекомендуется пересмотреть, отображается красная карточка

Пользователь может проигнорировать предупреждение (override) — это записывается в `user_overrides` и отмечается в финальном ТЗ.

---

## Аналитика

14 событий записываются в `analytics_events` через `POST /api/analytics`.

**Воронка:**
```
onboarding_demo_started → wizard_started → wizard_step_completed ×6
    → document_generated → document_exported
```

**Точки отказа:** `wizard_abandoned`, `wizard_error`

---

## Безопасность

- Пароли: Argon2id (не bcrypt)
- JWT: httpOnly-куки, `SameSite=Strict`, `Secure` в production
- SQL: параметризованные запросы через `pg.Pool` (без raw SQL в бизнес-логике)
- Валидация: Zod на всех API-эндпоинтах
- Rate limiting: 60 запросов/минуту через Redis
- CORS: ограничен `NEXTAUTH_URL`

---

## Масштабирование (будущее)

| Компонент | Текущее решение | При росте |
|-----------|----------------|-----------|
| БД | PostgreSQL single | Read replicas / PgBouncer |
| Кэш | Redis single | Redis Cluster |
| AI | Синхронные вызовы | Queue (Bull/BullMQ) + worker |
| Файлы | Локальная генерация | S3 + CloudFront |
| SSR | Next.js single | Vercel / Kubernetes |
