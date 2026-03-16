// Brief AI — Тестовый сценарий #1
// Источник: ТЗ п.3.6 «Стратегия тестирования качества AI»
// Тип: ecommerce, средняя сложность, 8 фич

export const testScenario1 = {
  id: 'test_ecommerce_clothing_01',
  name: 'Интернет-магазин одежды (средняя сложность)',
  project_type: 'ecommerce',
  difficulty: 'medium',

  // Имитация ответов пользователя на каждом шаге
  user_inputs: {
    step1_scope: [
      'Хочу сделать интернет-магазин одежды',
      // AI должен уточнить → пользователь отвечает:
      'У меня магазин в Москве, хочу продавать онлайн. Конкуренты — Lamoda и Wildberries, но у меня авторская одежда, мелкая партия.',
      // AI предлагает формулировку → пользователь подтверждает:
      'Да, верно. Цель — выйти в онлайн и получить первые 50 заказов в месяц.',
    ],
    step2_tasks: [
      'Хочу чтобы люди могли выбирать одежду, оплачивать и получать доставку.',
      // AI предлагает метрики → пользователь корректирует:
      'Да, конверсия в покупку и средний чек — главные. 50 заказов в месяц для начала.',
    ],
    step3_users: [
      'Покупатели и я как администратор.',
      // AI спрашивает про гостевой доступ:
      'Да, пусть можно покупать без регистрации.',
    ],
    step4_features: [
      // AI предлагает чеклист → пользователь выбирает:
      'Нужно: каталог, поиск, корзина, оплата, личный кабинет, админка. Отзывы пока не нужны.',
      // AI предупреждает: оплата → нужна авторизация:
      'Хорошо, пусть будет авторизация через email. Гости тоже могут покупать.',
    ],
    step5_nfr: [
      'Не знаю про нагрузку.',
      // AI предлагает типовые значения:
      'Да, 100 одновременных пользователей для начала нормально. Мобильная версия обязательно нужна.',
    ],
    step6_implementation: [
      'Предпочтений по стеку нет. Бюджет ограничен — стартап.',
    ],
  },

  // Эталонные ожидания от AI на каждом шаге
  expected_ai_behavior: {
    step1: {
      must_ask: ['какая проблема', 'конкуренты', 'чем отличаетесь'],
      must_detect: { project_type: 'ecommerce' },
      must_not: ['Отлично! Давайте перейдём к функциям.'],  // Шаблонный ответ = FAIL
    },
    step2: {
      must_propose_metrics: ['конверсия', 'средний чек'],
      must_decompose_into_tasks: true,
    },
    step3: {
      must_suggest_roles: ['покупатель', 'гость', 'администратор'],
      must_ask_about: ['гостевой доступ'],
    },
    step4: {
      must_check_dependency: { trigger: 'оплата', auto_suggest: ['авторизация', 'корзина'] },
      must_suggest_features_from_catalog: true,
      must_not_exceed: 15,  // Не больше 15 фич
    },
    step5: {
      must_propose_values: true,    // Не «какая нагрузка?», а «100 пользователей — подходит?»
      must_warn_if_missing: ['безопасность платежей'],
    },
    step6: {
      must_separate_hard_vs_recommendations: true,
    },
  },

  // Эталонный итоговый документ ТЗ
  expected_document: {
    problem: {
      must_mention: ['авторская одежда', 'мелкая партия', 'Lamoda', 'Wildberries'],
      must_not_be_generic: true,  // Не «проблема отсутствия онлайн-продаж»
    },
    goal: {
      must_be_measurable: true,   // «50 заказов в месяц»
    },
    functional_requirements: {
      must_include_user_stories: true,
      must_include_features: ['каталог', 'поиск', 'корзина', 'оплата', 'авторизация', 'админка'],
      must_include_auth: true,   // AI добавил, хотя пользователь не упомянул изначально
      must_not_include: ['отзывы'],  // Пользователь отказался
      must_show_moscow: true,
    },
    nfr: {
      must_include_load: '100 одновременных',
      must_include_mobile: true,
      must_include_payment_security: true,
      must_have_justifications: true,  // Каждое NFR с обоснованием
    },
    open_questions: {
      // AI не получил ответ → фиксирует, а не придумывает
      acceptable: ['способ доставки', 'конкретный платёжный шлюз'],
    },
  },

  // Критерии оценки (1-5 по каждому, порог ≥ 4.0 средняя)
  evaluation_criteria: [
    { name: 'completeness', description: 'Все 6 разделов заполнены, нет пустых блоков', weight: 0.25 },
    { name: 'specificity', description: 'Формулировки привязаны к контексту (одежда, Lamoda), а не шаблонные', weight: 0.25 },
    { name: 'consistency', description: 'Оплата и авторизация согласованы, нет противоречий', weight: 0.20 },
    { name: 'context_awareness', description: 'Конкуренты упомянуты, мелкая партия учтена', weight: 0.15 },
    { name: 'dev_readiness', description: 'Разработчик может начать работу без доп. вопросов', weight: 0.15 },
  ],

  // Порог: средневзвешенная ≥ 4.0
  passing_threshold: 4.0,
};
