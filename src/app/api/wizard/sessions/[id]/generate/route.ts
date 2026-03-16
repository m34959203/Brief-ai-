// Brief AI — API: Генерация ТЗ
import { NextRequest, NextResponse } from 'next/server';
import { getSessionState } from '@/lib/engine/wizard-engine';
import { generateDocument, checkContradictions } from '@/lib/ai/ai-service';
import { createDocument, getDocumentByProject } from '@/lib/db/repositories/brief-documents';
import { trackEvent } from '@/lib/analytics/tracker';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sessionId } = await params;
    const state = await getSessionState(sessionId);

    if (!state) {
      return NextResponse.json({ error: 'Сессия не найдена' }, { status: 404 });
    }

    // Проверяем, не сгенерирован ли уже документ
    const existing = await getDocumentByProject(state.project_id);
    if (existing) {
      return NextResponse.json({
        document_id: existing.id,
        sections: existing.sections,
        open_questions: existing.open_questions,
        completeness_score: existing.completeness_score,
      });
    }

    // Финальная проверка противоречий
    const contradictions = await checkContradictions(
      state.steps_data as Record<string, unknown>,
      state.structured_facts
    );

    // Генерация документа
    const documentSections = await generateDocument(
      state.steps_data as Record<string, unknown>,
      state.structured_facts,
      contradictions.contradictions
    );

    // Подсчёт completeness_score
    const sectionKeys = ['problem', 'goal', 'tasks', 'functional_requirements', 'non_functional_requirements', 'effects', 'implementation'];
    const filledSections = sectionKeys.filter(key =>
      documentSections[key] !== null && documentSections[key] !== undefined
    ).length;
    const completenessScore = Math.round((filledSections / sectionKeys.length) * 100);

    // Сбор open_questions из всех шагов
    const openQuestions: string[] = [];
    for (const stepData of Object.values(state.steps_data)) {
      const data = stepData as Record<string, unknown>;
      if (data?.open_questions && Array.isArray(data.open_questions)) {
        openQuestions.push(...data.open_questions);
      }
    }

    // Сохранение в БД
    const doc = await createDocument({
      project_id: state.project_id,
      sections: documentSections,
      open_questions: openQuestions,
      completeness_score: completenessScore,
      user_overrides: state.structured_facts.user_overrides,
    });

    trackEvent('document_generated', {
      session_id: sessionId,
      completeness_score: completenessScore,
      open_questions_count: openQuestions.length,
    });

    return NextResponse.json({
      document_id: doc.id,
      sections: doc.sections,
      open_questions: doc.open_questions,
      completeness_score: doc.completeness_score,
      user_overrides: doc.user_overrides,
    });
  } catch (error) {
    console.error('[API] Generate document error:', error);
    return NextResponse.json({ error: 'Ошибка генерации' }, { status: 500 });
  }
}
