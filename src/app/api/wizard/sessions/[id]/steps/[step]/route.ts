// Brief AI — API: Обработка шага wizard
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { processStep } from '@/lib/engine/wizard-engine';
import { trackEvent } from '@/lib/analytics/tracker';

const stepAnswerSchema = z.object({
  user_answer: z.string().min(1, 'Ответ не может быть пустым'),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; step: string }> }
) {
  try {
    const { id: sessionId, step } = await params;
    const stepNumber = parseInt(step);

    if (isNaN(stepNumber) || stepNumber < 1 || stepNumber > 6) {
      return NextResponse.json(
        { error: 'Невалидный номер шага (1-6)' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const data = stepAnswerSchema.parse(body);

    const result = await processStep(sessionId, stepNumber, data.user_answer);

    // Аналитика
    if (result.aiResponse.step_complete) {
      trackEvent('wizard_step_completed', {
        step_number: stepNumber,
        mode: 'text',
      });
    }

    if (result.aiResponse.contradictions.length > 0) {
      trackEvent('ai_contradiction_found', {
        step_number: stepNumber,
        count: result.aiResponse.contradictions.length,
      });
    }

    return NextResponse.json({
      ai_response: result.aiResponse.message,
      extracted_data: result.aiResponse.extracted_data,
      step_complete: result.aiResponse.step_complete,
      next_step: result.nextStep || null,
      contradictions: result.contradictions
        ? (result.contradictions as { contradictions: unknown[] }).contradictions
        : result.aiResponse.contradictions,
      open_questions: result.aiResponse.open_questions,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Ошибка валидации', details: error.errors },
        { status: 400 }
      );
    }
    console.error('[API] Process step error:', error);
    trackEvent('wizard_error', {
      error: error instanceof Error ? error.message : 'Unknown',
    });
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 });
  }
}
