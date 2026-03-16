# Contributing

Гайд для разработчиков проекта Brief AI.

## Требования

- Node.js 18+
- Docker и Docker Compose
- API-ключ Anthropic (Claude)

## Настройка окружения

```bash
# Клонирование
git clone https://github.com/m34959203/Brief-ai-.git
cd Brief-ai-

# Зависимости
npm install

# Переменные окружения
cp .env.example .env
# Заполните ANTHROPIC_API_KEY

# Инфраструктура (PostgreSQL + Redis)
docker compose up -d

# База данных
npm run db:migrate
npm run db:seed

# Запуск
npm run dev
```

## Структура кода

```
src/
├── app/           # Next.js App Router — страницы и API
├── components/    # React-компоненты
│   ├── ui/        # Дизайн-система (shadcn + кастомные)
│   └── wizard/    # Wizard-компоненты
└── lib/           # Бизнес-логика
    ├── ai/        # Claude API, промпты
    ├── analytics/  # Трекинг событий
    ├── auth/      # JWT-аутентификация
    ├── db/        # PostgreSQL + Redis + репозитории
    ├── document/  # Генерация и экспорт ТЗ
    └── engine/    # Wizard Engine
```

## Конвенции

### Язык

- Код, комментарии, коммиты — **на русском**
- Исключение: технические термины (API, JWT, CRUD, PostgreSQL)
- Имена переменных и функций — на **английском** (camelCase)

### Коммиты

Формат: `тип: описание на русском`

| Тип | Когда |
|-----|-------|
| `feat:` | Новая функциональность |
| `fix:` | Исправление бага |
| `refactor:` | Рефакторинг без изменения поведения |
| `docs:` | Документация |
| `test:` | Тесты |
| `chore:` | Конфиги, зависимости, инфраструктура |

Примеры:
```
feat: добавлен MoSCoW drag-and-drop на шаге 4
fix: потеря structured_facts при перезагрузке
docs: обновлена документация API
```

### TypeScript

- `strict: true` в `tsconfig.json`
- Явные типы для функций и параметров API
- Zod-схемы для валидации входных данных
- Нет `any` без явной причины

### SQL

- Все запросы через репозитории (`src/lib/db/repositories/`)
- Параметризованные запросы (`$1`, `$2`), никогда не конкатенация строк
- JSONB для сложных структур (structured_facts, extracted_data)

### Компоненты

- Файлы в `src/components/ui/` — переиспользуемые
- Файлы в `src/components/wizard/` — специфичные для визарда
- `'use client'` только где необходимо (интерактивные компоненты)
- Tailwind-классы, никакого inline CSS

## Работа с AI Service

### Добавление нового промпта

1. Добавьте шаблон в `src/lib/ai/prompts.ts`
2. Зарегистрируйте в `PROMPT_MAP`
3. Используйте плейсхолдеры `{{variable}}` для динамических данных

### Формат ответа AI

Все промпты требуют от Claude ответа в JSON:

```json
{
  "message": "Текст для пользователя",
  "extracted_data": { },
  "updated_facts": { },
  "contradictions": [],
  "step_complete": false,
  "open_questions": []
}
```

### structured_facts — священные данные

**Никогда** не заменяйте массивы — только мержите:

```typescript
// Правильно
must_features: Array.from(new Set([
  ...existing.must_features,
  ...new_features,
]))

// Неправильно
must_features: new_features  // Потеря данных!
```

## Работа с БД

### Добавление новой таблицы

1. Добавьте SQL в `prisma/schema.sql`
2. Обновите `scripts/migrate.ts`
3. Создайте репозиторий в `src/lib/db/repositories/`
4. Экспортируйте типы

### Миграции

```bash
npm run db:migrate   # Применить
npm run db:seed      # Загрузить FeatureCatalog
npm run db:reset     # Полный сброс
```

## Тестирование

### AI-eval

Сценарии в `tests/ai-eval/`. Шаблон: `scenario-01-ecommerce.ts`.

```bash
npm run test:ai-eval
```

Порог прохождения: средневзвешенная оценка >= 4.0 по 5 критериям.

### Критерии оценки

| Критерий | Вес | Описание |
|----------|-----|----------|
| completeness | 25% | Все 7 разделов заполнены |
| specificity | 25% | Формулировки привязаны к контексту |
| consistency | 20% | Нет противоречий |
| context_awareness | 15% | Упомянуты конкретные детали |
| dev_readiness | 15% | Разработчик может начать работу |

## Полезные ссылки

- [docs/API.md](docs/API.md) — REST API
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — архитектура
- [AGENTS.md](AGENTS.md) — план реализации и статус задач
