// Brief AI — API: Создание wizard-сессии
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthUser } from '@/lib/auth';
import { startSession } from '@/lib/engine/wizard-engine';
import { trackEvent } from '@/lib/analytics/tracker';

const createSessionSchema = z.object({
  brief_type: z.string().default('dev'),
  template_id: z.string().uuid().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = createSessionSchema.parse(body);

    // Демо-режим: если нет auth, создаём демо-пользователя
    const auth = await getAuthUser();
    const userId = auth?.userId || 'demo-user';

    const { sessionId, projectId } = await startSession(
      userId,
      data.brief_type,
      data.template_id
    );

    trackEvent(auth ? 'wizard_started' : 'onboarding_demo_started', {
      brief_type: data.brief_type,
      mode: 'text',
    });

    return NextResponse.json({
      session_id: sessionId,
      project_id: projectId,
      current_step: 1,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Ошибка валидации', details: error.errors },
        { status: 400 }
      );
    }
    console.error('[API] Create session error:', error);
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 });
  }
}
