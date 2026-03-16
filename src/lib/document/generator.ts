// Brief AI — Генератор ТЗ
// Собирает extracted_data со всех шагов, вызывает AI, сохраняет в brief_documents

import { getSessionState } from '@/lib/engine/wizard-engine';
import { generateDocument, checkContradictions } from '@/lib/ai/ai-service';
import { createDocument, getDocumentByProject } from '@/lib/db/repositories/brief-documents';
import { getStepsBySession } from '@/lib/db/repositories/wizard-steps';

export async function generateBrief(sessionId: string): Promise<{
  documentId: string;
  sections: Record<string, unknown>;
  openQuestions: string[];
  completenessScore: number;
  userOverrides: string[];
}> {
  const state = await getSessionState(sessionId);
  if (!state) throw new Error('Сессия не найдена');

  // Проверяем существующий документ
  const existing = await getDocumentByProject(state.project_id);
  if (existing) {
    return {
      documentId: existing.id,
      sections: existing.sections,
      openQuestions: existing.open_questions as string[],
      completenessScore: existing.completeness_score,
      userOverrides: existing.user_overrides as string[],
    };
  }

  // Собираем все данные шагов
  const steps = await getStepsBySession(sessionId);
  const allExtractedData: Record<string, unknown> = {};
  const allOpenQuestions: string[] = [];

  for (const step of steps) {
    if (step.extracted_data) {
      allExtractedData[`step_${step.step_number}`] = step.extracted_data;
      const data = step.extracted_data as Record<string, unknown>;
      if (Array.isArray(data?.open_questions)) {
        allOpenQuestions.push(...data.open_questions);
      }
    }
  }

  // Финальная проверка противоречий
  const contradictions = await checkContradictions(
    allExtractedData,
    state.structured_facts
  );

  // Генерация AI-документа
  const documentSections = await generateDocument(
    allExtractedData,
    state.structured_facts,
    contradictions.contradictions
  );

  // Подсчёт completeness_score
  const completenessScore = calculateCompleteness(documentSections);

  // Сохранение
  const doc = await createDocument({
    project_id: state.project_id,
    sections: documentSections,
    open_questions: allOpenQuestions,
    completeness_score: completenessScore,
    user_overrides: state.structured_facts.user_overrides,
  });

  return {
    documentId: doc.id,
    sections: doc.sections,
    openQuestions: allOpenQuestions,
    completenessScore,
    userOverrides: state.structured_facts.user_overrides,
  };
}

function calculateCompleteness(sections: Record<string, unknown>): number {
  const sectionKeys = [
    'problem', 'goal', 'tasks',
    'functional_requirements', 'non_functional_requirements',
    'effects', 'implementation',
  ];

  let score = 0;
  let maxScore = 0;

  for (const key of sectionKeys) {
    maxScore += 10;
    const section = sections[key];

    if (!section) continue;

    // Базовое наличие раздела = 5 баллов
    score += 5;

    // Глубина содержимого = до 5 доп. баллов
    const content = JSON.stringify(section);
    if (content.length > 200) score += 2;
    if (content.length > 500) score += 2;
    if (content.includes('user_story') || content.includes('acceptance_criteria')) score += 1;
  }

  return Math.round((score / maxScore) * 100);
}
