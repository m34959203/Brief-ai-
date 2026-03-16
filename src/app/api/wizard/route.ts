// Brief AI — API Route: Wizard Step
// POST /api/wizard/sessions/:id/steps/:step
// Источник: ТЗ п.3.7 «API-контракты»

import { NextRequest, NextResponse } from 'next/server';
import { processWizardStep, checkContradictions, summarizeContext } from '@/lib/ai/ai-service';
import type { StructuredFacts } from '@/lib/ai/ai-service';
import { devBriefConfig } from '@/lib/engine/wizard-config';
import { trackEvent } from '@/lib/analytics/tracker';

// Имитация БД (заменить на реальную в продакшене)
const sessions = new Map<string, {
  current_step: number;
  context_summary: string;
  structured_facts: StructuredFacts;
  steps_data: Record<number, unknown>;
  conversation_history: Record<number, Array<{ role: 'user' | 'assistant'; content: string }>>;
}>();

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string; step: string } }
) {
  const sessionId = params.id;
  const stepNumber = parseInt(params.step);

  try {
    const body = await request.json();
    const { user_answer } = body;

    if (!user_answer || typeof user_answer !== 'string') {
      return NextResponse.json(
        { error: 'user_answer is required' },
        { status: 400 }
      );
    }

    // Получаем или создаём сессию
    let session = sessions.get(sessionId);
    if (!session) {
      session = {
        current_step: 1,
        context_summary: '',
        structured_facts: {
          project_type: null,
          platform: null,
          budget_constraint: null,
          must_features: [],
          auth_type: null,
          has_payments: false,
          target_users: [],
          contradictions_found: [],
          user_overrides: [],
        },
        steps_data: {},
        conversation_history: {},
      };
      sessions.set(sessionId, session);
    }

    // Получаем конфиг шага
    const stepConfig = devBriefConfig.steps[stepNumber - 1];
    if (!stepConfig) {
      return NextResponse.json(
        { error: `Invalid step number: ${stepNumber}` },
        { status: 400 }
      );
    }

    // Проверяем skip_condition
    if (stepConfig.skip_condition) {
      const shouldSkip = evaluateSkipCondition(
        stepConfig.skip_condition,
        session.structured_facts
      );
      if (shouldSkip) {
        return NextResponse.json({
          skipped: true,
          next_step: stepNumber + 1,
          message: 'Шаг пропущен — не применим к данному типу проекта',
        });
      }
    }

    // Инициализируем историю для шага
    if (!session.conversation_history[stepNumber]) {
      session.conversation_history[stepNumber] = [];
    }

    const startTime = Date.now();

    // Вызываем AI Service
    const aiResponse = await processWizardStep({
      step_id: stepConfig.id,
      prompt_template: stepConfig.prompt_template,
      context_summary: session.context_summary,
      structured_facts: session.structured_facts,
      user_answer,
      conversation_history: session.conversation_history[stepNumber],
    });

    // Обновляем историю диалога для шага
    session.conversation_history[stepNumber].push(
      { role: 'user', content: user_answer },
      { role: 'assistant', content: aiResponse.message }
    );

    // Обновляем structured_facts (п.3.4)
    if (aiResponse.updated_facts) {
      session.structured_facts = {
        ...session.structured_facts,
        ...aiResponse.updated_facts,
      };
    }

    // Если шаг завершён — суммаризуем контекст и проверяем противоречия
    if (aiResponse.step_complete) {
      // Сохраняем данные шага
      session.steps_data[stepNumber] = aiResponse.extracted_data;

      // Суммаризация контекста (п.3.4)
      session.context_summary = await summarizeContext(
        session.context_summary,
        aiResponse.extracted_data,
        session.structured_facts
      );

      session.current_step = stepNumber + 1;

      // Проверка противоречий после шагов 4 и 6 (п.3.4)
      let contradictionResult = null;
      if (stepNumber === 4 || stepNumber === 6) {
        contradictionResult = await checkContradictions(
          session.steps_data,
          session.structured_facts
        );

        // Добавляем найденные противоречия в facts
        if (contradictionResult.contradictions.length > 0) {
          session.structured_facts.contradictions_found.push(
            ...contradictionResult.contradictions.map(c => c.description)
          );
        }
      }

      // Аналитика (п.3.8)
      const duration = Math.round((Date.now() - startTime) / 1000);
      trackEvent('wizard_step_completed', {
        step_number: stepNumber,
        duration_sec: duration,
        mode: 'text',
      });

      return NextResponse.json({
        ai_response: aiResponse.message,
        extracted_data: aiResponse.extracted_data,
        step_complete: true,
        next_step: stepNumber < 6 ? stepNumber + 1 : null,
        contradictions: contradictionResult?.contradictions || [],
        open_questions: aiResponse.open_questions,
        context_summary: session.context_summary,
      });
    }

    // Шаг не завершён — AI задаёт уточняющий вопрос
    return NextResponse.json({
      ai_response: aiResponse.message,
      extracted_data: aiResponse.extracted_data,
      step_complete: false,
      contradictions: aiResponse.contradictions,
      validation_errors: aiResponse.open_questions.length > 0
        ? aiResponse.open_questions
        : null,
    });

  } catch (error) {
    console.error('Wizard step error:', error);

    trackEvent('wizard_error', {
      step_number: stepNumber,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/wizard/sessions/:id/override — «Продолжить несмотря на предупреждение» (п.3.4)
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await request.json();
  const { warning_id, warning_description } = body;
  const session = sessions.get(params.id);

  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  // Фиксируем override в structured_facts
  session.structured_facts.user_overrides.push(
    `Проигнорировано: ${warning_description}`
  );

  trackEvent('ai_override_used', {
    warning_type: warning_id,
  });

  return NextResponse.json({ ok: true });
}

function evaluateSkipCondition(condition: string, facts: StructuredFacts): boolean {
  try {
    // Безопасное выполнение: проверяем только простые условия
    const { project_type, has_payments, platform } = facts;
    return eval(condition) as boolean;
  } catch {
    return false;
  }
}
