-- Brief AI — Схема БД (PostgreSQL)
-- Версия: 3.1 final | Март 2026
-- Автор: Техлид
-- Источник: ТЗ п.3.2 «Модель данных»

-- =============================================
-- 1. ПОЛЬЗОВАТЕЛИ
-- =============================================
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           VARCHAR(255) UNIQUE NOT NULL,
    password_hash   TEXT,                          -- Argon2id (п.4.3)
    name            VARCHAR(255),
    oauth_provider  VARCHAR(50),                   -- 'google' | null
    oauth_id        VARCHAR(255),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);

-- =============================================
-- 2. ШАБЛОНЫ
-- =============================================
CREATE TABLE templates (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brief_type      VARCHAR(50) NOT NULL,          -- dev, design, marketing, vacancy, api_spec
    name            VARCHAR(255) NOT NULL,
    description     TEXT,
    default_steps   JSONB NOT NULL,                -- Предзаполненные шаги
    is_active       BOOLEAN DEFAULT true,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 3. КАТАЛОГ ФИЧЕЙ (ключевая сущность — п.3.2)
-- Решает проблему фазировки: wizard берёт фичи
-- отсюда, а не из промпта
-- =============================================
CREATE TABLE feature_catalogs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_type    VARCHAR(50) NOT NULL,          -- ecommerce, landing, crm, mobile, bot
    features        JSONB NOT NULL,                -- [{name, description, depends_on[], typical_nfr[], priority_hint}]
    version         INT DEFAULT 1,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_feature_catalogs_type ON feature_catalogs(project_type);

-- =============================================
-- 4. ПРОЕКТЫ
-- =============================================
CREATE TABLE projects (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title           VARCHAR(500),
    brief_type      VARCHAR(50) NOT NULL DEFAULT 'dev',
    status          VARCHAR(20) NOT NULL DEFAULT 'draft',  -- draft | in_progress | completed
    template_id     UUID REFERENCES templates(id),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_projects_user ON projects(user_id);
CREATE INDEX idx_projects_status ON projects(status);

-- =============================================
-- 5. WIZARD-СЕССИИ
-- =============================================
CREATE TABLE wizard_sessions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id      UUID NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
    current_step    INT NOT NULL DEFAULT 1,        -- 1-6
    mode            VARCHAR(10) DEFAULT 'text',    -- text | voice
    
    -- Память между шагами (п.3.4 «Стратегия промптинга»)
    context_summary TEXT,                          -- 500-1000 токенов, обновляется после каждого шага
    
    -- Structured Facts — защита от потери деталей (п.3.4, НОВОЕ v3.1)
    structured_facts JSONB DEFAULT '{
        "project_type": null,
        "platform": null,
        "budget_constraint": null,
        "must_features": [],
        "auth_type": null,
        "has_payments": false,
        "target_users": [],
        "contradictions_found": [],
        "user_overrides": []
    }'::jsonb,
    
    started_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 6. ШАГИ WIZARD
-- =============================================
CREATE TABLE wizard_steps (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id      UUID NOT NULL REFERENCES wizard_sessions(id) ON DELETE CASCADE,
    step_number     INT NOT NULL,                  -- 1-6
    status          VARCHAR(20) DEFAULT 'pending', -- pending | active | completed
    
    -- Данные шага
    ai_questions    JSONB,                         -- Вопросы, которые AI задал
    user_answers    JSONB,                         -- Ответы пользователя
    extracted_data  JSONB,                         -- Что AI извлёк для раздела ТЗ
    
    -- Метаданные
    ai_calls_count  INT DEFAULT 0,                 -- Количество вызовов AI на этом шаге
    duration_sec    INT,                           -- Время на шаг
    
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(session_id, step_number)
);

CREATE INDEX idx_wizard_steps_session ON wizard_steps(session_id);

-- =============================================
-- 7. ДОКУМЕНТ ТЗ
-- =============================================
CREATE TABLE brief_documents (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id      UUID NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
    
    -- 6 разделов ТЗ (п.3.3 «Адаптивный шаблон»)
    sections        JSONB NOT NULL DEFAULT '{
        "problem": null,
        "goal": null,
        "tasks": null,
        "functional_requirements": null,
        "non_functional_requirements": null,
        "effects": null,
        "implementation": null
    }'::jsonb,
    
    open_questions      JSONB DEFAULT '[]'::jsonb,  -- Вопросы без ответа (п.3.1 US-5)
    completeness_score  INT DEFAULT 0,               -- 0-100%
    user_overrides      JSONB DEFAULT '[]'::jsonb,   -- Проигнорированные предупреждения (п.3.4)
    
    version         INT DEFAULT 1,
    exported_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 8. ГОЛОСОВЫЕ ТРАНСКРИПТЫ
-- =============================================
CREATE TABLE voice_transcripts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id      UUID NOT NULL REFERENCES wizard_sessions(id) ON DELETE CASCADE,
    step_number     INT NOT NULL,
    
    audio_url       TEXT,                          -- S3 URL
    raw_text        TEXT,                          -- Исходная транскрипция от STT
    corrected_text  TEXT,                          -- После коррекции пользователем
    confidence_scores JSONB,                       -- [{word, score}] для подсветки low-confidence
    duration_sec    INT,
    
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_voice_transcripts_session ON voice_transcripts(session_id);

-- =============================================
-- 9. АНАЛИТИЧЕСКИЕ СОБЫТИЯ (п.3.8)
-- =============================================
CREATE TABLE analytics_events (
    id              BIGSERIAL PRIMARY KEY,
    user_id         UUID REFERENCES users(id),
    session_id      UUID,
    event_name      VARCHAR(100) NOT NULL,         -- из таблицы п.3.8
    event_params    JSONB,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_analytics_events_name ON analytics_events(event_name);
CREATE INDEX idx_analytics_events_user ON analytics_events(user_id);
CREATE INDEX idx_analytics_events_created ON analytics_events(created_at);
