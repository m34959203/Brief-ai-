// Brief AI — Wizard Engine Config
// Источник: ТЗ п.3.3 «Wizard Engine: структура конфига»
// Каждый тип брифа описывается конфигом. Движок интерпретирует конфиг,
// а не содержит бизнес-логику шагов.

export interface WizardStepConfig {
  id: string;
  title: string;
  ai_role: 'po' | 'analyst' | 'both';
  prompt_template: string;           // Имя файла промпта из /prompts/
  questions: QuestionConfig[];
  validation_rules: ValidationRules;
  maps_to_section: string;           // Раздел ТЗ: problem, goal, tasks, func_req, nfr, effects, implementation
  skip_condition?: string;           // JS-выражение: "project_type === 'bot'"
}

export interface QuestionConfig {
  id: string;
  type: 'open' | 'choice' | 'multi_choice' | 'drag_drop';
  text: string;
  options?: string[];                // Для choice/multi_choice
  required: boolean;
}

export interface ValidationRules {
  min_entities?: number;             // Минимум сущностей/действий в ответе
  required_fields?: string[];
  max_retries: number;               // Макс. попыток уточнения (п.3.4: «максимум 3»)
}

export interface WizardConfig {
  brief_type: string;
  version: number;
  steps: WizardStepConfig[];
  document_template: {
    sections: string[];              // Порядок разделов в итоговом ТЗ
    format: string;                  // Шаблон форматирования
  };
}

// =============================================
// КОНФИГ: ТЗ на разработку (MVP)
// =============================================
export const devBriefConfig: WizardConfig = {
  brief_type: 'dev',
  version: 1,
  steps: [
    {
      id: 'scope',
      title: 'Суть проекта',
      ai_role: 'po',
      prompt_template: 'step1_scope',
      questions: [
        {
          id: 'idea',
          type: 'open',
          text: 'Опишите вашу идею — что вы хотите создать и какую проблему решить?',
          required: true
        }
      ],
      validation_rules: {
        min_entities: 3,     // Минимум 3 конкретных сущности/действия
        max_retries: 3
      },
      maps_to_section: 'problem,goal'
    },
    {
      id: 'tasks',
      title: 'Задачи и результат',
      ai_role: 'po',
      prompt_template: 'step2_tasks',
      questions: [
        {
          id: 'success_criteria',
          type: 'open',
          text: 'Как вы поймёте, что проект успешен? Что конкретно должно измениться?',
          required: true
        }
      ],
      validation_rules: {
        min_entities: 2,
        max_retries: 3
      },
      maps_to_section: 'tasks,effects'
    },
    {
      id: 'users',
      title: 'Пользователи и сценарии',
      ai_role: 'analyst',
      prompt_template: 'step3_users',
      questions: [
        {
          id: 'roles',
          type: 'multi_choice',
          text: 'Кто будет пользоваться системой?',
          options: [], // Заполняется AI из FeatureCatalog
          required: true
        }
      ],
      validation_rules: {
        required_fields: ['roles'],
        max_retries: 3
      },
      maps_to_section: 'functional_requirements'
    },
    {
      id: 'features',
      title: 'Функциональность',
      ai_role: 'both',
      prompt_template: 'step4_features',
      questions: [
        {
          id: 'feature_selection',
          type: 'multi_choice',
          text: 'Выберите нужные функции и добавьте свои:',
          options: [], // Заполняется из FeatureCatalog по project_type
          required: true
        }
      ],
      validation_rules: {
        max_retries: 3
      },
      maps_to_section: 'functional_requirements'
    },
    {
      id: 'nfr',
      title: 'Качество и ограничения',
      ai_role: 'analyst',
      prompt_template: 'step5_nfr',
      questions: [
        {
          id: 'platforms',
          type: 'multi_choice',
          text: 'На каких платформах должен работать продукт?',
          options: ['Web (десктоп)', 'Web (мобильный)', 'iOS', 'Android', 'Telegram', 'Не знаю — нужна рекомендация'],
          required: true
        }
      ],
      validation_rules: {
        max_retries: 3
      },
      maps_to_section: 'non_functional_requirements',
      skip_condition: undefined
    },
    {
      id: 'implementation',
      title: 'Реализация',
      ai_role: 'analyst',
      prompt_template: 'step6_implementation',
      questions: [
        {
          id: 'constraints',
          type: 'open',
          text: 'Есть ли технические ограничения, предпочтения по стеку или интеграции?',
          required: false
        }
      ],
      validation_rules: {
        max_retries: 2  // Менее строгий — пользователь может не знать
      },
      maps_to_section: 'implementation'
    }
  ],
  document_template: {
    sections: ['problem', 'goal', 'tasks', 'functional_requirements', 'non_functional_requirements', 'effects', 'implementation'],
    format: 'brief_v1'
  }
};
