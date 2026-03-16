// Brief AI — Analytics Tracker
// Источник: ТЗ п.3.8 «Аналитические события»
// 14 событий покрывают всю воронку: онбординг → wizard → генерация → экспорт

type EventName =
  | 'onboarding_demo_started'
  | 'onboarding_demo_to_registration'
  | 'wizard_started'
  | 'wizard_step_completed'
  | 'wizard_abandoned'
  | 'ai_question_asked'
  | 'ai_contradiction_found'
  | 'ai_override_used'
  | 'voice_mode_activated'
  | 'voice_error'
  | 'voice_to_text_switch'
  | 'document_generated'
  | 'document_exported'
  | 'document_edited'
  | 'wizard_error';

export function trackEvent(name: EventName, params?: Record<string, unknown>) {
  // В MVP — запись в БД. В продакшене — Amplitude/Mixpanel + БД.
  const event = {
    event_name: name,
    event_params: params || {},
    timestamp: new Date().toISOString(),
  };

  // Async: не блокируем UI
  if (typeof window !== 'undefined') {
    // Client-side: отправляем на API
    fetch('/api/analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
    }).catch(console.error);
  } else {
    // Server-side: пишем в БД напрямую
    console.log('[Analytics]', name, params);
    // TODO: db.analytics_events.create(event)
  }
}

// Маппинг событий на метрики из п.5.2
// Конверсия wizard = wizard_started → document_exported
// Время сессии = sum(wizard_step_completed.duration_sec)
// Retention 30d = unique users with wizard_started in 30d window
// Качество AI = document_edited (меньше правок = лучше генерация)
