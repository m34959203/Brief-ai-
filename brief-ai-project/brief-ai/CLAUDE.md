# CLAUDE.md — Brief AI

## Кто ты
Ты — full-stack разработчик и AI-инженер, реализующий проект Brief AI. Пиши код, коммиты и комментарии на русском языке. Работай без воды, по делу.

## Что за проект
Brief AI — веб-приложение, которое заменяет роль Product Owner и бизнес-аналитика на этапе создания ТЗ. AI ведёт пользователя через 6-шаговый wizard (текст или голос), задаёт уточняющие вопросы, ловит противоречия, предлагает фичи из каталога и генерирует готовый документ ТЗ.

Ключевое отличие от ChatGPT: Brief AI не принимает первый ответ — копает до конкретики, проверяет зависимости, не пускает дальше без валидации. Ядро продукта — процесс сбора и валидации, а не генерация текста.

## Стек технологий

### Жёсткие ограничения (не обсуждаются)
- **AI:** Anthropic Claude API (модель claude-sonnet-4-20250514)
- **STT (фаза 2):** Deepgram или AssemblyAI (streaming, не Whisper — он не реалтайм)
- **БД:** PostgreSQL + JSONB для гибких схем
- **Кэш/сессии:** Redis
- **Хранилище файлов:** S3-совместимое

### Рекомендации (можно менять при обосновании)
- **Frontend:** Next.js 14+ (App Router), TypeScript
- **UI:** Tailwind CSS + shadcn/ui
- **Backend:** Next.js API Routes (MVP), при росте — вынести в NestJS
- **Очереди:** BullMQ (Redis)
- **TTS (фаза 2):** ElevenLabs или YandexSpeechKit
- **Деплой:** Docker + Railway
- **Аутентификация:** NextAuth.js (email + Google OAuth)

## Архитектура

```
Frontend (Next.js SPA)
  ↓ REST API (п.3.7 ТЗ)
API Gateway (JWT 15мин + refresh 7д, rate limit 60rpm/user)
  ↓
Wizard Engine (конфигурируемый, JSON-конфиги)
  ↓
AI Service (отдельный промпт на каждый шаг + context_summary + structured_facts)
  ↓
Document Service (генерация PDF/DOCX/MD)
  ↓
Storage (PostgreSQL + Redis + S3)
```

Voice Service (фаза 2): WebSocket + STT streaming + TTS + буферизация

## Схема данных (9 таблиц)

```
users → projects → wizard_sessions → wizard_steps
                 → brief_documents
                 → voice_transcripts (фаза 2)
templates (справочник)
feature_catalogs (справочник — ключевая сущность!)
analytics_events
```

Ключевые поля:
- `wizard_sessions.context_summary` — сжатый контекст предыдущих шагов (500-1000 токенов), обновляется после каждого шага
- `wizard_sessions.structured_facts` — JSONB, жёсткие факты (project_type, platform, must_features, has_payments, auth_type, contradictions_found, user_overrides), передаются в КАЖДЫЙ промпт целиком
- `wizard_steps.extracted_data` — JSONB, что AI извлёк для раздела ТЗ
- `brief_documents.sections` — JSONB, 7 разделов ТЗ (problem, goal, tasks, functional_requirements, non_functional_requirements, effects, implementation)
- `brief_documents.open_questions` — JSONB, вопросы без ответа (AI фиксирует, а НЕ придумывает)
- `feature_catalogs.features` — JSONB, массив [{name, description, depends_on[], typical_nfr[], priority_hint}]

Полная схема: `prisma/schema.sql`

## API-контракты

### REST (Frontend → Backend)
```
POST   /api/wizard/sessions                    — создать сессию {brief_type, template_id?}
GET    /api/wizard/sessions/:id                — получить состояние (восстановление черновика)
PUT    /api/wizard/sessions/:id/steps/:step    — отправить ответ {user_answer} → {ai_response, extracted_data, step_complete, contradictions}
POST   /api/wizard/sessions/:id/override       — продолжить несмотря на предупреждение {warning_id}
POST   /api/wizard/sessions/:id/generate       — сгенерировать ТЗ → {document_id, preview_url}
GET    /api/documents/:id/export/:format       — экспорт (pdf/docx/md) → file stream
```

### WebSocket — Voice Service (фаза 2)
```
Client→Server: audio_chunk (binary opus 16kHz mono)
Server→Client: transcript_partial (промежуточная транскрипция)
Server→Client: transcript_final (финальный текст + confidence_scores[])
Server→Client: feedback_card ({extracted_data, maps_to_section, low_confidence_words[]})
Server→Client: tts_audio (opus stream вопроса AI)
Client→Server: correction ({word_index, corrected_text})
Server→Client: snr_warning (SNR < 10dB → предложить текстовый режим)
```

## Wizard Engine — конфигурируемый

Каждый тип брифа описан JSON-конфигом. Движок интерпретирует конфиг, а не содержит бизнес-логику.

Конфиг шага:
```typescript
{
  id: string,                    // scope, tasks, users, features, nfr, implementation
  title: string,
  ai_role: 'po' | 'analyst' | 'both',
  prompt_template: string,       // Имя промпта из PROMPT_MAP
  questions: [{type: 'open'|'choice'|'multi_choice'|'drag_drop', ...}],
  validation_rules: {min_entities?, required_fields?, max_retries: 3},
  maps_to_section: string,       // Какой раздел ТЗ заполняет
  skip_condition?: string,       // "project_type === 'bot'" → пропустить шаг
}
```

Файл конфига: `src/lib/engine/wizard-config.ts`

## Стратегия промптинга (КРИТИЧЕСКИ ВАЖНО)

### Архитектура: отдельный промпт на каждый шаг
НЕ один промпт на сессию. Причины: разные роли AI на шагах, контроль контекста, тестируемость.

### 5 компонентов каждого промпта
1. **Роль:** «Ты — опытный PO/аналитик. На этом шаге ты [X].»
2. **Контекст:** context_summary с предыдущих шагов
3. **Инструкция:** конкретные правила (не принимай размытые ответы, предлагай варианты, лови противоречия)
4. **Формат:** JSON-схема ответа (message, extracted_data, updated_facts, contradictions, step_complete, open_questions)
5. **Примеры:** 2-3 примера хороших и плохих диалогов (few-shot)

### Память между шагами
- **context_summary** (500-1000 токенов) — сжатый контекст, обновляется после каждого шага
- **structured_facts** (~200-400 токенов) — жёсткие key-value факты, передаются ЦЕЛИКОМ в каждый промпт. Не теряются при суммаризации:
  - project_type, platform, budget_constraint, must_features[], auth_type, has_payments, target_users[], contradictions_found[], user_overrides[]

### Проверка противоречий
Отдельный вызов AI после шагов 4 и 6. Промпт: «Найди противоречия, пропущенные зависимости, нереалистичные требования.»

### Стратегия «3 попытки» (когда пользователь не знает ответ)
1. AI переформулирует вопрос проще
2. AI предлагает готовые варианты на выбор
3. AI фиксирует как открытый вопрос и пускает дальше

### Право на несогласие
Каждый блок валидации/предупреждения имеет кнопку «Продолжить несмотря на предупреждение». Override записывается в structured_facts.user_overrides[] и отображается в финальном ТЗ.

Файл промптов: `src/lib/ai/prompts.ts`
AI Service: `src/lib/ai/ai-service.ts`

## FeatureCatalog (ключевая сущность)

Wizard на шаге 4 берёт типовые фичи из FeatureCatalog (а не из промпта!). Это решает проблему масштабируемости.

5 типов проектов × 10-15 фич = 48 записей с:
- Названием и описанием (1-2 предложения)
- Зависимостями (depends_on[])
- Типовыми NFR (typical_nfr[])
- Подсказкой приоритета (priority_hint: must/should/could)

Файл: `seed/feature-catalog.ts`

## Контекстное окно и себестоимость

Бюджет на сессию: 80-120K токенов суммарно (20-28 вызовов Claude API).

| Этап | Input tokens | Стоимость |
|------|-------------|-----------|
| Шаг 1 (3-4 вызова) | 2-5K | $0.03-0.06 |
| Шаги 2-6 (по 3-4 вызова) | 3-6K каждый | $0.10-0.30 |
| Проверка противоречий (×2) | 8-10K | $0.06-0.08 |
| Суммаризация (×6) | 3-5K | $0.05-0.08 |
| Финальная генерация | 12-15K | $0.10-0.15 |
| **ИТОГО** | **80-120K** | **$0.40-0.70** |

С голосом (фаза 2): +$0.15-0.48 (STT + TTS) = $0.55-1.18/сессия.

## NFR

- Ответ AI: ≤ 5с (стриминг Claude: первый токен 0.5-1с)
- Time to First Question: ≤ 3с (прелоад конфига + каталога, AI-сессия параллельно)
- Генерация документа: ≤ 20с
- FCP: ≤ 1.5с
- Задержка STT (фаза 2): ≤ 2с
- MVP: 100 одновременных пользователей (~3000 MAU)
- Uptime: 99%
- Автосохранение: 30с Redis, 5мин PostgreSQL
- Безопасность: Argon2id, JWT 15мин + httpOnly refresh 7д, AES-256 at rest, CSP/CSRF
- Адаптив: десктоп ≥1280px, планшет ≥768px, мобильный ≥375px

## Аналитические события (14 штук)

```
onboarding_demo_started, onboarding_demo_to_registration,
wizard_started, wizard_step_completed, wizard_abandoned,
ai_question_asked, ai_contradiction_found, ai_override_used,
voice_mode_activated, voice_error, voice_to_text_switch,
document_generated, document_exported, document_edited
```

Каждое событие привязано к метрике:
- Конверсия wizard = wizard_started → document_exported (цель ≥ 70%)
- Время сессии = sum(step_completed.duration_sec) (цель ≤ 45мин)
- Качество генерации = document_edited (меньше правок = лучше)

Файл: `src/lib/analytics/tracker.ts`

## Тестирование качества AI

### Автоматические тесты (каждый деплой)
- 15 сценариев (по 3 на тип проекта)
- Структурная валидация: 6 разделов, нет пустых, user stories в формате
- Семантическая проверка: AI-оценщик (отдельный вызов Claude) по 5 критериям: полнота, конкретность, непротиворечивость, привязанность к контексту, пригодность для разработки
- Regression-порог: качество не падает >5% при изменении промптов

### Ручное (раз в спринт)
- Слепое сравнение Brief AI vs ChatGPT (3 оценщика × 5 пар ТЗ)
- Цель: ≥ 70% предпочтение Brief AI

Пример сценария: `tests/ai-eval/scenario-01-ecommerce.ts`

## Обработка ошибок голосового ввода (фаза 2)

| Сценарий | Поведение |
|----------|-----------|
| STT ошибка | Подсветка low-confidence слов (<0.7), клик для исправления текстом |
| Речь >2мин без пауз | Разбивка на блоки 30-60с, карточка после каждого блока |
| Фоновый шум | SNR-анализ до сессии, предложение текстового режима при <10dB |
| Микс RU+EN | Кастомный словарь 500+ терминов + AI пост-обработка («куб Эрнест» → «Kubernetes») |
| Потеря соединения | Буфер аудио на клиенте 30с, WebSocket reconnect с exponential backoff, IndexedDB для wizard state |

## Онбординг (US-8)

1. Лендинг: интерактивный пример готового ТЗ + сравнение «Brief AI vs ChatGPT»
2. Демо: шаг 1 wizard БЕЗ регистрации (aha-момент — AI задаёт уточняющие вопросы)
3. Для продолжения (шаги 2-6 + экспорт) — регистрация, данные шага 1 сохраняются
4. Интерактивный тур: 3 тултипа при первом входе

## Фазы реализации

### Фаза 1 — MVP
- [ ] Текстовый wizard (6 шагов) + AI с ролью PO/аналитика
- [ ] FeatureCatalog для 5 типов проектов
- [ ] Онбординг: демо шага 1 + пример ТЗ
- [ ] Генерация ТЗ (6 разделов) + блоки «Открытые вопросы» и «Полнота»
- [ ] Экспорт: Markdown + PDF
- [ ] Регистрация по email
- [ ] 15 тестовых сценариев + авто-проверки качества
- [ ] 14 аналитических событий

### Фаза 2 — Голос и шаблоны
- [ ] Voice Service (Deepgram STT + TTS + карточка + обработка ошибок)
- [ ] 5 шаблонов с предзаполнением
- [ ] DOCX-экспорт
- [ ] OAuth Google
- [ ] Offline: буферизация, IndexedDB, reconnect

### Фаза 3 — Расширение
- [ ] Новые типы брифов (дизайн, маркетинг, вакансия)
- [ ] Адаптивный шаблон документа
- [ ] История версий

### Фаза 4 — Масштабирование
- [ ] Командная работа
- [ ] API для интеграций
- [ ] Кастомные конфиги wizard через админ-панель

## Правила разработки

1. **Коммиты на русском:** `feat: добавил шаг 4 wizard — функциональность`
2. **Не хардкодь бизнес-логику шагов** — всё через конфиг wizard
3. **AI-ответы — всегда JSON** с полями message, extracted_data, updated_facts, contradictions, step_complete, open_questions
4. **Не теряй structured_facts** — передаются в КАЖДЫЙ промпт целиком
5. **Автосохранение** — Redis каждые 30с, PostgreSQL каждые 5 мин
6. **Аналитика** — трекай событие при каждом значимом действии пользователя
7. **Не придумывай за пользователя** — если AI не получил ответ, фиксируй как open_question
8. **Тесты при изменении промптов** — прогони 15 сценариев, проверь regression ≤ 5%
