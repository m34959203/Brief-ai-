// Brief AI — Репозиторий: Аналитика
import { query } from '../index';

export async function trackEvent(data: {
  user_id?: string;
  session_id?: string;
  event_name: string;
  event_params?: Record<string, unknown>;
}): Promise<void> {
  await query(
    `INSERT INTO analytics_events (user_id, session_id, event_name, event_params)
     VALUES ($1, $2, $3, $4)`,
    [
      data.user_id || null,
      data.session_id || null,
      data.event_name,
      JSON.stringify(data.event_params || {}),
    ]
  );
}
