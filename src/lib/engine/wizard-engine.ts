// Brief AI — Wizard Engine
// Движок шагов с кэшированием в Redis

import { devBriefConfig, type WizardStepConfig } from './wizard-config';
import { processWizardStep, checkContradictions, summarizeContext } from '@/lib/ai/ai-service';
import type { StructuredFacts, AIResponse } from '@/lib/ai/ai-service';
import * as projectsRepo from '@/lib/db/repositories/projects';
import * as sessionsRepo from '@/lib/db/repositories/wizard-sessions';
import * as stepsRepo from '@/lib/db/repositories/wizard-steps';
import { getCatalogByType } from '@/lib/db/repositories/feature-catalogs';
import { getRedis, setRedis, delRedis } from '@/lib/db';

const CACHE_TTL = 3600; // 1 час
const CACHE_PREFIX = 'wizard:session:';

// Кэш состояния сессии
interface SessionCache {
  session_id: string;
  project_id: string;
  current_step: number;
  context_summary: string;
  structured_facts: StructuredFacts;
  steps_data: Record<number, unknown>;
  conversation_history: Record<number, Array<{ role: 'user' | 'assistant'; content: string }>>;
}

// =============================================
// Создание новой сессии
// =============================================
export async function startSession(
  userId: string,
  briefType: string = 'dev',
  templateId?: string
): Promise<{ sessionId: string; projectId: string }> {
  // Создаём проект
  const project = await projectsRepo.createProject({
    user_id: userId,
    brief_type: briefType,
    template_id: templateId,
  });

  // Создаём wizard-сессию
  const session = await sessionsRepo.createSession(project.id);

  // Создаём 6 шагов
  await stepsRepo.createAllSteps(session.id, devBriefConfig.steps.length);

  // Кэшируем в Redis
  const cache: SessionCache = {
    session_id: session.id,
    project_id: project.id,
    current_step: 1,
    context_summary: '',
    structured_facts: session.structured_facts,
    steps_data: {},
    conversation_history: {},
  };
  await setRedis(`${CACHE_PREFIX}${session.id}`, JSON.stringify(cache), CACHE_TTL);

  return { sessionId: session.id, projectId: project.id };
}

// =============================================
// Получение состояния сессии
// =============================================
export async function getSessionState(sessionId: string): Promise<SessionCache | null> {
  // Пробуем кэш
  const cached = await getRedis(`${CACHE_PREFIX}${sessionId}`);
  if (cached) return JSON.parse(cached);

  // Fallback на БД
  const session = await sessionsRepo.getSession(sessionId);
  if (!session) return null;

  const steps = await stepsRepo.getStepsBySession(sessionId);
  const stepsData: Record<number, unknown> = {};
  for (const step of steps) {
    if (step.extracted_data) {
      stepsData[step.step_number] = step.extracted_data;
    }
  }

  const cache: SessionCache = {
    session_id: session.id,
    project_id: session.project_id,
    current_step: session.current_step,
    context_summary: session.context_summary || '',
    structured_facts: session.structured_facts,
    steps_data: stepsData,
    conversation_history: {},
  };

  // Восстанавливаем кэш
  await setRedis(`${CACHE_PREFIX}${sessionId}`, JSON.stringify(cache), CACHE_TTL);
  return cache;
}

// =============================================
// Обработка шага
// =============================================
export async function processStep(
  sessionId: string,
  stepNumber: number,
  userAnswer: string
): Promise<{
  aiResponse: AIResponse;
  contradictions?: unknown;
  nextStep?: number;
}> {
  const state = await getSessionState(sessionId);
  if (!state) throw new Error('Сессия не найдена');

  const stepConfig = devBriefConfig.steps[stepNumber - 1];
  if (!stepConfig) throw new Error(`Невалидный номер шага: ${stepNumber}`);

  // Проверка skip_condition
  if (checkSkipCondition(stepConfig, state.structured_facts)) {
    return {
      aiResponse: {
        message: 'Шаг пропущен — не применим к данному типу проекта.',
        extracted_data: {},
        updated_facts: {},
        contradictions: [],
        step_complete: true,
        open_questions: [],
      },
      nextStep: stepNumber + 1,
    };
  }

  // Подгружаем FeatureCatalog для шагов 3-4
  let featureCatalog: string | undefined;
  if ((stepNumber === 3 || stepNumber === 4) && state.structured_facts.project_type) {
    const catalog = await getCatalogByType(state.structured_facts.project_type);
    if (catalog) {
      featureCatalog = JSON.stringify(catalog.features);
    }
  }

  // Получаем историю диалога шага
  if (!state.conversation_history[stepNumber]) {
    state.conversation_history[stepNumber] = [];
  }

  const startTime = Date.now();

  // Вызов AI Service
  const aiResponse = await processWizardStep({
    step_id: stepConfig.id,
    prompt_template: stepConfig.prompt_template,
    context_summary: state.context_summary,
    structured_facts: state.structured_facts,
    user_answer: userAnswer,
    feature_catalog: featureCatalog,
    conversation_history: state.conversation_history[stepNumber],
  });

  // Обновляем историю
  state.conversation_history[stepNumber].push(
    { role: 'user', content: userAnswer },
    { role: 'assistant', content: aiResponse.message }
  );

  // Обновляем structured_facts (мержим, не заменяем!)
  if (aiResponse.updated_facts) {
    state.structured_facts = {
      ...state.structured_facts,
      ...aiResponse.updated_facts,
      // Массивы мержим, не заменяем
      must_features: Array.from(new Set([
        ...state.structured_facts.must_features,
        ...(aiResponse.updated_facts.must_features || []),
      ])),
      target_users: Array.from(new Set([
        ...state.structured_facts.target_users,
        ...(aiResponse.updated_facts.target_users || []),
      ])),
      contradictions_found: [
        ...state.structured_facts.contradictions_found,
        ...(aiResponse.updated_facts.contradictions_found || []),
      ],
      user_overrides: [
        ...state.structured_facts.user_overrides,
        ...(aiResponse.updated_facts.user_overrides || []),
      ],
    };
  }

  const duration = Math.round((Date.now() - startTime) / 1000);

  // Обновляем шаг в БД
  const currentStep = await stepsRepo.getStep(sessionId, stepNumber);
  await stepsRepo.updateStep(sessionId, stepNumber, {
    ai_questions: aiResponse.message,
    user_answers: state.conversation_history[stepNumber],
    extracted_data: aiResponse.extracted_data,
    ai_calls_count: (currentStep?.ai_calls_count || 0) + 1,
    duration_sec: duration,
    status: aiResponse.step_complete ? 'completed' : 'active',
  });

  let contradictionResult = null;

  if (aiResponse.step_complete) {
    // Сохраняем данные шага
    state.steps_data[stepNumber] = aiResponse.extracted_data;

    // Суммаризация контекста
    state.context_summary = await summarizeContext(
      state.context_summary,
      aiResponse.extracted_data,
      state.structured_facts
    );

    // Переходим к следующему шагу
    state.current_step = stepNumber < 6 ? stepNumber + 1 : 6;

    // Активируем следующий шаг
    if (stepNumber < 6) {
      await stepsRepo.updateStep(sessionId, stepNumber + 1, { status: 'active' });
    }

    // Проверка противоречий после шагов 4 и 6
    if (stepNumber === 4 || stepNumber === 6) {
      contradictionResult = await checkContradictions(
        state.steps_data,
        state.structured_facts
      );

      if (contradictionResult.contradictions.length > 0) {
        state.structured_facts.contradictions_found.push(
          ...contradictionResult.contradictions.map((c: { description: string }) => c.description)
        );
      }
    }

    // Обновляем сессию в БД
    await sessionsRepo.updateSession(sessionId, {
      current_step: state.current_step,
      context_summary: state.context_summary,
      structured_facts: state.structured_facts,
    });

    // Обновляем статус проекта
    if (stepNumber === 6) {
      await projectsRepo.updateProject(state.project_id, { status: 'completed' });
    } else if (stepNumber === 1) {
      await projectsRepo.updateProject(state.project_id, {
        status: 'in_progress',
        title: (aiResponse.extracted_data as Record<string, string>)?.project_goal || undefined,
      });
    }
  }

  // Обновляем кэш Redis
  await setRedis(`${CACHE_PREFIX}${sessionId}`, JSON.stringify(state), CACHE_TTL);

  return {
    aiResponse,
    contradictions: contradictionResult,
    nextStep: aiResponse.step_complete && stepNumber < 6 ? stepNumber + 1 : undefined,
  };
}

// =============================================
// Override предупреждения
// =============================================
export async function overrideWarning(
  sessionId: string,
  warningId: string,
  description: string
): Promise<void> {
  const state = await getSessionState(sessionId);
  if (!state) throw new Error('Сессия не найдена');

  state.structured_facts.user_overrides.push(
    `Проигнорировано: ${description}`
  );

  await sessionsRepo.updateStructuredFacts(sessionId, state.structured_facts);
  await setRedis(`${CACHE_PREFIX}${sessionId}`, JSON.stringify(state), CACHE_TTL);
}

// =============================================
// Проверка skip_condition
// =============================================
export function checkSkipCondition(
  stepConfig: WizardStepConfig,
  facts: StructuredFacts
): boolean {
  if (!stepConfig.skip_condition) return false;

  try {
    const { project_type, has_payments, platform } = facts;
    // Используем Function вместо eval для безопасности
    const fn = new Function('project_type', 'has_payments', 'platform',
      `return (${stepConfig.skip_condition})`
    );
    return fn(project_type, has_payments, platform) as boolean;
  } catch {
    return false;
  }
}

// =============================================
// Проверка завершённости шага
// =============================================
export function isStepComplete(
  stepNumber: number,
  extractedData: Record<string, unknown>,
  validationRules: { min_entities?: number; required_fields?: string[]; max_retries: number },
  retryCount: number
): boolean {
  // Если превышено число попыток — шаг завершён
  if (retryCount >= validationRules.max_retries) return true;

  // Проверка min_entities
  if (validationRules.min_entities) {
    const entityCount = Object.values(extractedData).filter(v => v !== null && v !== undefined).length;
    if (entityCount < validationRules.min_entities) return false;
  }

  // Проверка required_fields
  if (validationRules.required_fields) {
    for (const field of validationRules.required_fields) {
      if (!extractedData[field]) return false;
    }
  }

  return true;
}
