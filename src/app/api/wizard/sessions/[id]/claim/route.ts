// Brief AI — API: Привязка демо-сессии к пользователю
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { getSessionState } from '@/lib/engine/wizard-engine';
import { query } from '@/lib/db';
import { trackEvent } from '@/lib/analytics/tracker';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sessionId } = await params;
    const auth = await getAuthUser();

    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const state = await getSessionState(sessionId);
    if (!state) {
      return NextResponse.json({ error: 'Сессия не найдена' }, { status: 404 });
    }

    // Привязываем проект к пользователю
    await query(
      'UPDATE projects SET user_id = $1, updated_at = NOW() WHERE id = $2',
      [auth.userId, state.project_id]
    );

    trackEvent('onboarding_demo_to_registration', {
      session_id: sessionId,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[API] Claim session error:', error);
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 });
  }
}
