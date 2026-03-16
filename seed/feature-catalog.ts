// Brief AI — FeatureCatalog
// Автор: Product Owner
// Источник: анализ 20 реальных ТЗ + экспертная оценка
// Задача: wizard на шаге 2 берёт фичи ОТСЮДА, а не из промпта (п.3.2)

export interface Feature {
  id: string;
  name: string;
  description: string;
  depends_on: string[];       // ID фич-зависимостей
  typical_nfr: string[];      // Типичные NFR, которые подтягиваются автоматически
  priority_hint: 'must' | 'should' | 'could';  // Рекомендация для MoSCoW
}

export interface FeatureCatalogEntry {
  project_type: string;
  typical_roles: { name: string; description: string }[];
  features: Feature[];
}

export const featureCatalogs: FeatureCatalogEntry[] = [
  // =============================================
  // 1. ИНТЕРНЕТ-МАГАЗИН (ecommerce)
  // =============================================
  {
    project_type: 'ecommerce',
    typical_roles: [
      { name: 'Покупатель', description: 'Выбирает товары, оформляет и оплачивает заказ' },
      { name: 'Гость', description: 'Просматривает каталог без регистрации, может оформить заказ' },
      { name: 'Администратор', description: 'Управляет каталогом, заказами, пользователями' },
      { name: 'Менеджер заказов', description: 'Обрабатывает заказы, связывается с покупателями' },
    ],
    features: [
      { id: 'ec_catalog', name: 'Каталог товаров', description: 'Отображение товаров с фото, описанием, ценой. Категории и подкатегории.', depends_on: [], typical_nfr: ['SEO-оптимизация страниц товаров', 'Загрузка каталога < 2с'], priority_hint: 'must' },
      { id: 'ec_search', name: 'Поиск и фильтры', description: 'Полнотекстовый поиск по товарам. Фильтры по цене, размеру, цвету, категории.', depends_on: ['ec_catalog'], typical_nfr: ['Результаты поиска < 1с', 'Автоподсказки при вводе'], priority_hint: 'must' },
      { id: 'ec_cart', name: 'Корзина', description: 'Добавление товаров, изменение количества, удаление. Пересчёт суммы. Сохранение между сессиями.', depends_on: ['ec_catalog'], typical_nfr: ['Сохранение корзины в localStorage для гостей'], priority_hint: 'must' },
      { id: 'ec_auth', name: 'Авторизация', description: 'Регистрация по email/телефону. Вход, восстановление пароля. OAuth (Google).', depends_on: [], typical_nfr: ['Argon2id для паролей', 'JWT 15мин + refresh'], priority_hint: 'must' },
      { id: 'ec_checkout', name: 'Оформление заказа', description: 'Выбор адреса доставки, способа доставки и оплаты. Подтверждение заказа.', depends_on: ['ec_cart', 'ec_auth'], typical_nfr: ['Checkout за 3 клика максимум'], priority_hint: 'must' },
      { id: 'ec_payment', name: 'Онлайн-оплата', description: 'Интеграция с платёжным шлюзом (ЮKassa, Stripe). Оплата картой, СБП.', depends_on: ['ec_checkout'], typical_nfr: ['PCI DSS (через iframe шлюза)', 'Webhook для статусов'], priority_hint: 'must' },
      { id: 'ec_profile', name: 'Личный кабинет', description: 'История заказов, сохранённые адреса, настройки профиля.', depends_on: ['ec_auth'], typical_nfr: ['GDPR/152-ФЗ: возможность удалить аккаунт'], priority_hint: 'should' },
      { id: 'ec_reviews', name: 'Отзывы и рейтинги', description: 'Оценка товаров (1-5 звёзд), текстовые отзывы с фото. Модерация.', depends_on: ['ec_auth', 'ec_catalog'], typical_nfr: ['Модерация перед публикацией'], priority_hint: 'should' },
      { id: 'ec_wishlist', name: 'Избранное', description: 'Сохранение товаров в список желаний. Уведомление о снижении цены.', depends_on: ['ec_auth', 'ec_catalog'], typical_nfr: [], priority_hint: 'could' },
      { id: 'ec_promo', name: 'Промокоды и скидки', description: 'Создание промокодов (% или фикс), автоматические скидки по условиям.', depends_on: ['ec_cart'], typical_nfr: ['Защита от перебора промокодов'], priority_hint: 'should' },
      { id: 'ec_notifications', name: 'Уведомления', description: 'Email-уведомления о статусе заказа. Push-уведомления (опционально).', depends_on: ['ec_auth'], typical_nfr: ['Email: Transactional (SendGrid/Resend)', 'Retry при ошибках отправки'], priority_hint: 'should' },
      { id: 'ec_admin', name: 'Админ-панель', description: 'CRUD товаров, управление заказами, статистика продаж, управление пользователями.', depends_on: ['ec_catalog'], typical_nfr: ['Ролевая модель: admin, manager'], priority_hint: 'must' },
      { id: 'ec_analytics', name: 'Аналитика', description: 'Дашборд: продажи, конверсия, средний чек, топ товаров. Интеграция с GA4/Яндекс.Метрика.', depends_on: ['ec_admin'], typical_nfr: ['Отчёты за период', 'Экспорт CSV'], priority_hint: 'could' },
    ]
  },

  // =============================================
  // 2. ЛЕНДИНГ (landing)
  // =============================================
  {
    project_type: 'landing',
    typical_roles: [
      { name: 'Посетитель', description: 'Приходит по рекламе, читает, оставляет заявку' },
      { name: 'Администратор', description: 'Управляет контентом, просматривает заявки' },
    ],
    features: [
      { id: 'ln_hero', name: 'Hero-секция', description: 'Заголовок, подзаголовок, CTA-кнопка, фоновое изображение/видео.', depends_on: [], typical_nfr: ['LCP < 2.5с'], priority_hint: 'must' },
      { id: 'ln_form', name: 'Форма заявки', description: 'Сбор имени, телефона, email. Валидация. Отправка в CRM или на email.', depends_on: [], typical_nfr: ['Защита от спама (honeypot + rate limit)', 'Подтверждение отправки'], priority_hint: 'must' },
      { id: 'ln_benefits', name: 'Блок преимуществ', description: 'Иконки + текст. 3-6 ключевых преимуществ продукта.', depends_on: [], typical_nfr: [], priority_hint: 'must' },
      { id: 'ln_social_proof', name: 'Социальное доказательство', description: 'Отзывы клиентов, логотипы партнёров, цифры (количество клиентов, лет на рынке).', depends_on: [], typical_nfr: [], priority_hint: 'should' },
      { id: 'ln_pricing', name: 'Тарифы', description: 'Сравнительная таблица тарифов с CTA на каждом.', depends_on: [], typical_nfr: [], priority_hint: 'should' },
      { id: 'ln_faq', name: 'FAQ', description: 'Аккордеон с частыми вопросами. SEO-оптимизация (schema.org FAQ).', depends_on: [], typical_nfr: ['Schema.org разметка'], priority_hint: 'should' },
      { id: 'ln_seo', name: 'SEO-оптимизация', description: 'Meta-теги, Open Graph, sitemap, robots.txt. Core Web Vitals.', depends_on: [], typical_nfr: ['CWV: LCP<2.5, FID<100, CLS<0.1'], priority_hint: 'must' },
      { id: 'ln_analytics_int', name: 'Аналитика', description: 'GA4, Яндекс.Метрика, цели и события, UTM-разметка.', depends_on: [], typical_nfr: ['GDPR cookie consent'], priority_hint: 'should' },
      { id: 'ln_ab', name: 'A/B тестирование', description: 'Возможность тестировать разные варианты заголовков, CTA, форм.', depends_on: ['ln_analytics_int'], typical_nfr: [], priority_hint: 'could' },
    ]
  },

  // =============================================
  // 3. CRM
  // =============================================
  {
    project_type: 'crm',
    typical_roles: [
      { name: 'Менеджер по продажам', description: 'Ведёт сделки, общается с клиентами' },
      { name: 'Руководитель отдела', description: 'Контролирует воронку, распределяет лиды' },
      { name: 'Администратор', description: 'Настраивает систему, управляет пользователями' },
    ],
    features: [
      { id: 'crm_contacts', name: 'Базу контактов', description: 'Карточки клиентов: ФИО, контакты, компания, история взаимодействий.', depends_on: [], typical_nfr: ['Поиск по контактам < 1с', 'Импорт из Excel/CSV'], priority_hint: 'must' },
      { id: 'crm_deals', name: 'Воронка продаж', description: 'Kanban-доска сделок. Перетаскивание между этапами. Автоматические триггеры.', depends_on: ['crm_contacts'], typical_nfr: ['Drag-and-drop без лагов'], priority_hint: 'must' },
      { id: 'crm_tasks', name: 'Задачи и напоминания', description: 'Привязка задач к сделкам и контактам. Дедлайны, уведомления.', depends_on: ['crm_contacts'], typical_nfr: ['Push/email напоминания'], priority_hint: 'must' },
      { id: 'crm_auth', name: 'Авторизация и роли', description: 'Вход по email. Роли: менеджер, руководитель, админ. Ограничение доступа к данным.', depends_on: [], typical_nfr: ['Менеджер видит только свои сделки'], priority_hint: 'must' },
      { id: 'crm_reports', name: 'Отчёты', description: 'Конверсия воронки, среднее время сделки, план/факт по менеджерам.', depends_on: ['crm_deals'], typical_nfr: ['Отчёт за период < 5с'], priority_hint: 'should' },
      { id: 'crm_email', name: 'Email-интеграция', description: 'Отправка писем из CRM. Шаблоны. История переписки в карточке клиента.', depends_on: ['crm_contacts'], typical_nfr: ['IMAP/SMTP интеграция'], priority_hint: 'should' },
      { id: 'crm_import', name: 'Импорт/экспорт', description: 'Импорт контактов из CSV/Excel. Экспорт отчётов и базы.', depends_on: ['crm_contacts'], typical_nfr: ['Импорт до 10 000 записей < 30с'], priority_hint: 'should' },
    ]
  },

  // =============================================
  // 4. МОБИЛЬНОЕ ПРИЛОЖЕНИЕ (mobile)
  // =============================================
  {
    project_type: 'mobile',
    typical_roles: [
      { name: 'Пользователь', description: 'Основной пользователь приложения' },
      { name: 'Администратор', description: 'Управляет контентом и пользователями через веб-панель' },
    ],
    features: [
      { id: 'mob_auth', name: 'Авторизация', description: 'Вход по телефону (SMS-код), email, Apple/Google Sign-In. Биометрия.', depends_on: [], typical_nfr: ['Biometric auth (FaceID/TouchID)', 'Secure token storage (Keychain/Keystore)'], priority_hint: 'must' },
      { id: 'mob_onboarding', name: 'Онбординг', description: '3-5 экранов при первом запуске. Объяснение ключевых функций.', depends_on: [], typical_nfr: ['Возможность пропустить'], priority_hint: 'should' },
      { id: 'mob_profile', name: 'Профиль', description: 'Аватар, имя, настройки, управление подпиской.', depends_on: ['mob_auth'], typical_nfr: ['Удаление аккаунта (требование App Store)'], priority_hint: 'must' },
      { id: 'mob_push', name: 'Push-уведомления', description: 'FCM/APNs. Категории уведомлений. Настройка пользователем.', depends_on: [], typical_nfr: ['Запрос разрешения не на первом экране'], priority_hint: 'should' },
      { id: 'mob_offline', name: 'Офлайн-режим', description: 'Кэширование данных. Синхронизация при восстановлении сети.', depends_on: [], typical_nfr: ['Conflict resolution при синхронизации'], priority_hint: 'could' },
      { id: 'mob_analytics', name: 'Аналитика', description: 'Firebase Analytics / Amplitude. Экраны, события, воронки.', depends_on: [], typical_nfr: ['IDFA consent (iOS 14+)'], priority_hint: 'should' },
      { id: 'mob_deeplinks', name: 'Deep Links', description: 'Переход по ссылке открывает конкретный экран приложения.', depends_on: [], typical_nfr: ['Universal Links (iOS) + App Links (Android)'], priority_hint: 'should' },
      { id: 'mob_payments', name: 'Встроенные покупки', description: 'In-App Purchase / Google Play Billing. Подписки или разовые покупки.', depends_on: ['mob_auth'], typical_nfr: ['Комиссия 15-30% App Store/Google Play', 'Восстановление покупок'], priority_hint: 'could' },
    ]
  },

  // =============================================
  // 5. TELEGRAM-БОТ (bot)
  // =============================================
  {
    project_type: 'bot',
    typical_roles: [
      { name: 'Пользователь бота', description: 'Взаимодействует с ботом в Telegram' },
      { name: 'Администратор', description: 'Управляет ботом, просматривает статистику' },
    ],
    features: [
      { id: 'bot_commands', name: 'Команды бота', description: 'Набор команд (/start, /help, /menu и кастомные). Inline-кнопки.', depends_on: [], typical_nfr: ['Ответ бота < 2с'], priority_hint: 'must' },
      { id: 'bot_dialog', name: 'Диалоговые сценарии', description: 'Многошаговые диалоги с ветвлением. Конечные автоматы для состояний.', depends_on: ['bot_commands'], typical_nfr: ['Graceful handling при неожиданном вводе'], priority_hint: 'must' },
      { id: 'bot_db', name: 'Хранение данных', description: 'Профили пользователей, история действий, настройки.', depends_on: [], typical_nfr: ['Бэкап раз в день'], priority_hint: 'must' },
      { id: 'bot_notifications', name: 'Рассылки и напоминания', description: 'Отправка сообщений по расписанию или событию. Сегментация аудитории.', depends_on: ['bot_db'], typical_nfr: ['Rate limit Telegram API: 30 msg/sec', 'Очередь для массовых рассылок'], priority_hint: 'should' },
      { id: 'bot_payments_tg', name: 'Платежи через Telegram', description: 'Telegram Payments API или ссылка на внешний шлюз.', depends_on: ['bot_commands'], typical_nfr: ['Webhook для подтверждения оплаты'], priority_hint: 'could' },
      { id: 'bot_admin', name: 'Админ-панель', description: 'Веб-интерфейс: статистика, управление рассылками, просмотр пользователей.', depends_on: ['bot_db'], typical_nfr: ['Базовая авторизация для админки'], priority_hint: 'should' },
      { id: 'bot_ai', name: 'AI-ответы', description: 'Интеграция с LLM для ответов на вопросы пользователей. Контекст диалога.', depends_on: ['bot_dialog'], typical_nfr: ['Токен-бюджет на пользователя', 'Fallback при недоступности AI'], priority_hint: 'could' },
    ]
  }
];
