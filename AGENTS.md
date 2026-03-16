# AGENTS.md — Инструкция для AI-агентов

> Этот файл — пошаговый план реализации и текущий статус проекта Brief AI.
> Каждая задача — самостоятельная единица работы для AI-агента.

---

## Общие правила

1. **Язык:** код, коммиты, комментарии — на русском, кроме технических терминов (API, JWT, CRUD)
2. **Коммиты:** `feat:`, `fix:`, `refactor:`, `docs:`, `test:` + описание на русском
3. **Не ломай существующее** — перед изменением проверь, что уже работает
4. **Файлы-основа** (не переписывай с нуля):
   - `prisma/schema.sql` — схема БД (9 таблиц)
   - `src/lib/engine/wizard-config.ts` — конфиг 6 шагов
   - `src/lib/ai/prompts.ts` — 8 промптов
   - `src/lib/ai/ai-service.ts` — Claude API (стриминг, retry)
   - `src/lib/engine/wizard-engine.ts` — движок шагов (Redis-кэш)
   - `src/lib/analytics/tracker.ts` — 14 аналитических событий
   - `src/components/wizard/Wizard.tsx` — UI визарда
   - `seed/feature-catalog.ts` — каталог фичей (5 типов)

---

## Статус реализации

### Спринт 1: Фундамент — ВЫПОЛНЕН

| # | Задача | Статус | Файлы |
|---|--------|--------|-------|
| 1 | Инициализация (Next.js, Tailwind, Docker) | Done | `docker-compose.yml`, `tailwind.config.ts`, `.env.example` |
| 2 | База данных (миграции, репозитории, seed) | Done | `src/lib/db/`, `scripts/migrate.ts`, `scripts/seed.ts` |
| 3 | Аутентификация (JWT, Argon2id, демо) | Done | `src/lib/auth/`, `src/middleware.ts`, auth pages |
| 4 | Wizard Engine (движок шагов, Redis) | Done | `src/lib/engine/wizard-engine.ts` |
| 5 | AI Service (стриминг, retry, FeatureCatalog) | Done | `src/lib/ai/ai-service.ts` |
| 6 | API-роуты (wizard, documents, analytics) | Done | `src/app/api/` (10 эндпоинтов) |
| 7 | Генерация и экспорт ТЗ (MD + PDF) | Done | `src/lib/document/` |

### Спринт 2: Интерфейс — ВЫПОЛНЕН

| # | Задача | Статус | Файлы |
|---|--------|--------|-------|
| 8 | Дизайн-система (shadcn + кастомные) | Done | `src/components/ui/` (9 компонентов) |
| 9 | Wizard UI (чат, сайдбар, мобильный) | Done | `src/components/wizard/Wizard.tsx`, `/wizard/[sessionId]` |
| 10 | Превью ТЗ + inline-редактирование | Done | `/documents/[id]` |
| 11 | Лендинг + демо-режим | Done | `/page.tsx`, `/wizard/demo` |
| 12 | Дашборд (список проектов) | Done | `/dashboard` |

### Спринт 3: Качество и полировка — В РАБОТЕ

| # | Задача | Статус | Описание |
|---|--------|--------|----------|
| 13 | Аналитика | Pending | Встроить 14 событий + admin-дашборд |
| 14 | AI-тестирование | Pending | 15 сценариев + авто-оценка + regression |
| 15 | MoSCoW drag-and-drop | Pending | Визуальная приоритизация на шаге 4 |
| 16 | Обработка ошибок | Pending | Error boundary, offline, rate limit UI |

---

## Задача 13: Аналитика

**Зависимости:** Задачи 6, 9
**Файлы:** `src/lib/analytics/tracker.ts`, `POST /api/analytics`

**Что сделать:**
1. Встроить все 14 событий в соответствующие места:
   - Frontend: `onboarding_demo_started`, `wizard_abandoned`, `voice_mode_activated`, `voice_to_text_switch`, `document_edited`
   - Backend: `wizard_started`, `wizard_step_completed`, `ai_question_asked`, `ai_contradiction_found`, `ai_override_used`, `document_generated`, `document_exported`
2. Создать admin-дашборд `/admin/analytics/page.tsx`:
   - Конверсия wizard (started → exported)
   - Среднее время сессии
   - Drop-off по шагам
   - Топ-5 типов проектов

**Критерии приёмки:**
- [ ] Все 14 событий записываются в `analytics_events`
- [ ] Дашборд показывает конверсию и drop-off

---

## Задача 14: AI-тестирование

**Зависимости:** Задача 5
**Файлы:** `tests/ai-eval/`

**Что сделать:**
1. Создать 14 дополнительных сценариев (шаблон: `scenario-01-ecommerce.ts`):
   - ecommerce: электроника (сложный), хендмейд (простой)
   - landing: SaaS, ресторан, онлайн-курс
   - crm: отдел продаж, рекрутинг, поддержка
   - mobile: фитнес, доставка, соцсеть
   - bot: поддержка, запись на приём, развлекательный
2. Создать раннер `tests/ai-eval/run-eval.ts`:
   - Прогон user_inputs → структурная проверка → семантическая оценка (Claude-оценщик)
   - 5 критериев (completeness, specificity, consistency, context_awareness, dev_readiness)
   - Порог: средневзвешенная >= 4.0
3. Regression-чек: сохранение в `tests/ai-eval/results/`, сравнение при повторном прогоне

**Критерии приёмки:**
- [ ] 15 сценариев с user_inputs и expected_document
- [ ] `npm run test:ai-eval` выполняется за <10 минут
- [ ] PASS/FAIL на основе порога >= 4.0
- [ ] Regression: падение >5% → FAIL

---

## Задача 15: MoSCoW drag-and-drop

**Зависимости:** Задача 9
**Файлы:** `src/components/wizard/MoscowBoard.tsx`

**Что сделать:**
1. 4 колонки: Must / Should / Could / Won't
2. Карточки фичей из FeatureCatalog с drag-and-drop (@dnd-kit/core)
3. Проверка зависимостей при перетаскивании
4. Предупреждение при >10 фич в Must
5. Интеграция с шагом 4 визарда

**Критерии приёмки:**
- [ ] Drag-and-drop на десктопе и тач
- [ ] Зависимости проверяются
- [ ] Данные сохраняются в extracted_data

---

## Задача 16: Обработка ошибок и edge cases

**Зависимости:** Задачи 6, 9
**Файлы:** `src/app/error.tsx`, компоненты

**Что сделать:**
1. `src/app/error.tsx` — глобальный error boundary
2. AI timeout (30с) → сообщение + retry-кнопка
3. Потеря сессии → redirect на дашборд
4. Пустой FeatureCatalog → fallback на генерацию из промпта
5. Короткий ответ (<20 символов) → inline-подсказка
6. 429 Rate limit → UI-сообщение
7. Offline → уведомление + localStorage-сохранение

**Критерии приёмки:**
- [ ] Ни один edge case не крашит приложение
- [ ] Пользователь видит понятное сообщение
- [ ] Данные не теряются при ошибках

---

## Граф зависимостей

```
[1] Инициализация ✓
 ├── [2] База данных ✓
 │    ├── [3] Аутентификация ✓
 │    ├── [4] Wizard Engine ✓ ─────────────┐
 │    └── [5] AI Service ✓ ────────────────┤
 │         └── [14] Тестирование AI        │
 │                                         │
 ├── [8] Дизайн-система ✓                  │
 │                                         │
 └── [6] API-роуты ✓ ◄────────────────────┘
      ├── [7] Генерация документа ✓
      ├── [9] Wizard UI ✓ ◄── [8] ✓
      │    ├── [10] Превью ТЗ ✓ ◄── [7] ✓
      │    ├── [11] Онбординг ✓
      │    ├── [12] Дашборд ✓ ◄── [3] ✓
      │    └── [15] MoSCoW drag-drop
      ├── [13] Аналитика
      └── [16] Обработка ошибок
```

---

## Критерий готовности MVP

- [x] Шаг 1 доступен без регистрации (демо-режим)
- [x] Все 6 шагов wizard с AI-диалогом
- [x] AI задаёт уточняющие вопросы
- [x] AI предлагает фичи из FeatureCatalog на шаге 4
- [x] Проверка противоречий после шагов 4 и 6
- [x] Override предупреждений
- [x] 3 попытки уточнения → open_question
- [x] ТЗ из 7 разделов + open_questions + completeness_score
- [x] Экспорт Markdown и PDF
- [x] Данные не теряются при перезагрузке
- [ ] 15 AI-eval сценариев >= 4.0
- [ ] 14 аналитических событий в БД
- [x] Мобильный адаптив (375px)
