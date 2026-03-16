# API Reference

Brief AI REST API. Все эндпоинты принимают и возвращают JSON (кроме экспорта).

**Base URL:** `http://localhost:3000/api`

---

## Аутентификация

Используется JWT через httpOnly-куки. Access token (15 мин) + Refresh token (7 дней).

Защищённые эндпоинты возвращают `401 Unauthorized` при отсутствии валидного токена.

**Исключение:** `POST /api/wizard/sessions` и шаг 1 доступны без аутентификации (демо-режим).

---

## Auth

### POST /api/auth/register

Регистрация нового пользователя.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "minlength8",
  "name": "Иван"           // необязательно
}
```

**Response (201):**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "Иван"
  }
}
```

**Ошибки:**
- `400` — невалидные данные (пароль < 8 символов, некорректный email)
- `409` — email уже зарегистрирован

---

### POST /api/auth/login

Вход в систему. Устанавливает httpOnly-куки `access_token` и `refresh_token`.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "minlength8"
}
```

**Response (200):**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "Иван"
  }
}
```

**Ошибки:**
- `401` — неверный email или пароль

---

### POST /api/auth/logout

Выход. Очищает куки.

**Response (200):**
```json
{ "ok": true }
```

---

### GET /api/auth/me

Текущий пользователь (по JWT из куки).

**Response (200):**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "Иван"
  }
}
```

**Ошибки:**
- `401` — не авторизован

---

## Wizard Sessions

### POST /api/wizard/sessions

Создание новой wizard-сессии. Доступно без аутентификации (демо-режим).

**Request:**
```json
{
  "brief_type": "dev",          // по умолчанию "dev"
  "template_id": "uuid"         // необязательно
}
```

**Response (200):**
```json
{
  "session_id": "uuid",
  "project_id": "uuid",
  "current_step": 1
}
```

---

### GET /api/wizard/sessions/:id

Получение текущего состояния сессии.

**Response (200):**
```json
{
  "session_id": "uuid",
  "project_id": "uuid",
  "current_step": 3,
  "structured_facts": {
    "project_type": "ecommerce",
    "platform": ["web"],
    "budget_constraint": null,
    "must_features": ["каталог", "корзина"],
    "auth_type": "email",
    "has_payments": true,
    "target_users": ["покупатель", "админ"],
    "contradictions_found": [],
    "user_overrides": []
  },
  "context_summary": "Интернет-магазин авторской одежды...",
  "steps_data": {
    "1": { "problem_statement": "...", "project_goal": "..." },
    "2": { "tasks": [...], "success_metrics": [...] }
  }
}
```

**Ошибки:**
- `404` — сессия не найдена

---

### PUT /api/wizard/sessions/:id/steps/:step

Отправка ответа пользователя на шаг. Вызывает AI Service, возвращает ответ AI.

**URL-параметры:**
- `:id` — UUID сессии
- `:step` — номер шага (1–6)

**Request:**
```json
{
  "user_answer": "Хочу интернет-магазин одежды для авторских коллекций"
}
```

**Response (200):**
```json
{
  "ai_response": "Расскажите подробнее о ситуации...",
  "extracted_data": {
    "project_type": "ecommerce",
    "context": "Авторская одежда, мелкие партии"
  },
  "step_complete": false,
  "next_step": null,
  "contradictions": [],
  "open_questions": []
}
```

Когда шаг завершён (`step_complete: true`):
```json
{
  "ai_response": "Отлично, переходим к задачам...",
  "extracted_data": { ... },
  "step_complete": true,
  "next_step": 2,
  "contradictions": [],
  "open_questions": []
}
```

После шагов 4 и 6 — автоматическая проверка противоречий:
```json
{
  "contradictions": [
    {
      "description": "Выбрана оплата, но не указана авторизация",
      "severity": "critical",
      "suggestion": "Добавьте авторизацию через email"
    }
  ]
}
```

**Ошибки:**
- `400` — невалидный номер шага или пустой ответ
- `404` — сессия не найдена

---

### POST /api/wizard/sessions/:id/override

Игнорирование предупреждения (противоречия). Записывается в `structured_facts.user_overrides[]` и отображается в финальном ТЗ.

**Request:**
```json
{
  "warning_id": "contradiction_1",
  "warning_description": "Оплата без авторизации"
}
```

**Response (200):**
```json
{ "ok": true }
```

---

### POST /api/wizard/sessions/:id/generate

Генерация финального документа ТЗ. Вызывает AI для проверки противоречий и генерации 7 разделов.

**Response (200):**
```json
{
  "document_id": "uuid",
  "sections": {
    "problem": "...",
    "goal": "...",
    "tasks": [...],
    "functional_requirements": [...],
    "non_functional_requirements": [...],
    "effects": "...",
    "implementation": { ... }
  },
  "open_questions": ["Способ доставки", "Платёжный шлюз"],
  "completeness_score": 86,
  "user_overrides": ["Проигнорировано: оплата без авторизации"]
}
```

**Ошибки:**
- `404` — сессия не найдена

> При повторном вызове возвращает уже сгенерированный документ (идемпотентность).

---

### POST /api/wizard/sessions/:id/claim

Привязка демо-сессии к зарегистрированному пользователю. Вызывается после регистрации, если пользователь начинал в демо-режиме.

**Response (200):**
```json
{ "ok": true }
```

---

## Documents

### GET /api/documents/:id/export/:format

Экспорт документа. Возвращает файл для скачивания.

**URL-параметры:**
- `:id` — UUID документа
- `:format` — `md` или `pdf`

**Response для `md`:**
- `Content-Type: text/markdown; charset=utf-8`
- `Content-Disposition: attachment; filename="brief-{id}.md"`
- Тело: Markdown-документ

**Response для `pdf`:**
- `Content-Type: text/html; charset=utf-8`
- Тело: HTML с CSS для печати (клиент использует `window.print()` или сохраняет как PDF)

**Ошибки:**
- `400` — неподдерживаемый формат
- `404` — документ не найден

---

### PUT /api/documents/:id/sections/:section

Inline-редактирование раздела документа.

**URL-параметры:**
- `:id` — UUID документа
- `:section` — ключ раздела (`problem`, `goal`, `tasks`, `functional_requirements`, `non_functional_requirements`, `effects`, `implementation`)

**Request:**
```json
{
  "content": "Обновлённый текст раздела..."
}
```

**Response (200):**
```json
{
  "ok": true,
  "completeness_score": 86
}
```

---

## Analytics

### POST /api/analytics

Запись аналитического события.

**Request:**
```json
{
  "event_name": "wizard_step_completed",
  "event_params": {
    "step_number": 3,
    "mode": "text"
  }
}
```

**Response (200):**
```json
{ "ok": true }
```

### Список событий

| Событие | Когда |
|---------|-------|
| `onboarding_demo_started` | Начало демо без регистрации |
| `wizard_started` | Начало полного wizard |
| `wizard_step_completed` | Завершение шага (params: step_number, mode) |
| `ai_question_asked` | AI задал уточняющий вопрос |
| `ai_contradiction_found` | Найдено противоречие (params: step_number, count) |
| `ai_override_used` | Пользователь проигнорировал предупреждение |
| `wizard_abandoned` | Выход из wizard без завершения |
| `document_generated` | ТЗ сгенерировано (params: completeness_score) |
| `document_exported` | Экспорт (params: format) |
| `document_edited` | Inline-редактирование раздела |
| `voice_mode_activated` | Переключение на голосовой режим (фаза 2) |
| `voice_to_text_switch` | Возврат к текстовому режиму |
| `voice_error` | Ошибка STT/TTS |
| `wizard_error` | Ошибка в процессе wizard |

---

## Коды ошибок

| Код | Описание |
|-----|----------|
| `400` | Невалидные данные (Zod-валидация) |
| `401` | Не авторизован |
| `404` | Ресурс не найден |
| `409` | Конфликт (email уже существует) |
| `429` | Rate limit (60 запросов/минуту) |
| `500` | Внутренняя ошибка сервера |

Все ошибки возвращаются в формате:
```json
{
  "error": "Описание ошибки на русском",
  "details": [...]    // Zod-ошибки (только для 400)
}
```
