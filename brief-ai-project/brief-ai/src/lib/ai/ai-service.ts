// Brief AI — AI Service
// Источник: ТЗ п.3.4 «Стратегия промптинга», п.3.5 «Управление контекстным окном»
// Отдельный промпт на каждый шаг + context_summary + structured_facts

import Anthropic from '@anthropic-ai/sdk';
import { PROMPT_MAP, CONTRADICTION_CHECK, DOCUMENT_GENERATION } from './prompts';

const client = new Anthropic();

// =============================================
// ТИПЫ
// =============================================
export interface StructuredFacts {
  project_type: string | null;
  platform: string[] | null;
  budget_constraint: string | null;
  must_features: string[];
  auth_type: string | null;
  has_payments: boolean;
  target_users: string[];
  contradictions_found: string[];
  user_overrides: string[];         // п.3.4 «Право на несогласие»
}

export interface AIRequest {
  step_id: string;                  // scope, tasks, users, features, nfr, implementation
  prompt_template: string;          // Имя из PROMPT_MAP
  context_summary: string;          // Сжатый контекст предыдущих шагов (500-1000 токенов)
  structured_facts: StructuredFacts;
  user_answer: string;              // Текущий ответ пользователя
  feature_catalog?: string;         // JSON каталога фич для данного типа проекта
  conversation_history?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

export interface AIResponse {
  message: string;                  // Текст для пользователя
  extracted_data: Record<string, unknown>;
  updated_facts: Partial<StructuredFacts>;
  contradictions: Array<{ description: string; severity: 'warning' | 'critical' }>;
  step_complete: boolean;
  open_questions: string[];
  updated_summary?: string;         // Обновлённый context_summary
}

// =============================================
// ОСНОВНОЙ МЕТОД: обработка шага wizard
// =============================================
export async function processWizardStep(req: AIRequest): Promise<AIResponse> {
  // 1. Получаем шаблон промпта
  const promptTemplate = PROMPT_MAP[req.prompt_template];
  if (!promptTemplate) {
    throw new Error(`Unknown prompt template: ${req.prompt_template}`);
  }

  // 2. Заполняем плейсхолдеры
  const systemPrompt = fillTemplate(promptTemplate, {
    context_summary: req.context_summary || 'Первый шаг, контекста нет.',
    structured_facts: JSON.stringify(req.structured_facts, null, 2),
    project_type: req.structured_facts.project_type || 'не определён',
    feature_catalog: req.feature_catalog || '{}',
    feature_catalog_roles: req.feature_catalog || '{}',
  });

  // 3. Формируем историю сообщений
  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [
    ...(req.conversation_history || []),
    { role: 'user', content: req.user_answer },
  ];

  // 4. Вызов Claude API
  // Бюджет контекста (п.3.5):
  // Шаги 1-3: ~3-5K input tokens
  // Шаги 4-6: ~5-8K input tokens (растёт context_summary)
  // Финальная генерация: ~12-15K input tokens
  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    system: systemPrompt,
    messages: messages.map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
  });

  // 5. Парсим ответ
  const rawText = response.content
    .filter(block => block.type === 'text')
    .map(block => block.type === 'text' ? block.text : '')
    .join('');

  return parseAIResponse(rawText);
}

// =============================================
// ПРОВЕРКА ПРОТИВОРЕЧИЙ (п.3.4)
// Запускается после шагов 4 и 6
// =============================================
export async function checkContradictions(
  allExtractedData: Record<string, unknown>,
  structuredFacts: StructuredFacts
): Promise<{
  contradictions: Array<{ description: string; severity: string; suggestion: string }>;
  missing_dependencies: Array<{ feature: string; requires: string; suggestion: string }>;
  overall_consistency_score: number;
}> {
  const prompt = fillTemplate(CONTRADICTION_CHECK, {
    all_extracted_data: JSON.stringify(allExtractedData, null, 2),
    structured_facts: JSON.stringify(structuredFacts, null, 2),
  });

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    system: prompt,
    messages: [{ role: 'user', content: 'Проведи проверку.' }],
  });

  const rawText = response.content
    .filter(block => block.type === 'text')
    .map(block => block.type === 'text' ? block.text : '')
    .join('');

  return JSON.parse(extractJSON(rawText));
}

// =============================================
// ГЕНЕРАЦИЯ ФИНАЛЬНОГО ДОКУМЕНТА (после шага 6)
// =============================================
export async function generateDocument(
  allExtractedData: Record<string, unknown>,
  structuredFacts: StructuredFacts,
  contradictions: unknown[]
): Promise<Record<string, unknown>> {
  const prompt = fillTemplate(DOCUMENT_GENERATION, {
    all_extracted_data: JSON.stringify(allExtractedData, null, 2),
    structured_facts: JSON.stringify(structuredFacts, null, 2),
    contradictions: JSON.stringify(contradictions, null, 2),
  });

  // Финальная генерация — самый дорогой вызов: ~12-15K input, ~3-5K output
  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 8000,
    system: prompt,
    messages: [{ role: 'user', content: 'Сгенерируй техническое задание.' }],
  });

  const rawText = response.content
    .filter(block => block.type === 'text')
    .map(block => block.type === 'text' ? block.text : '')
    .join('');

  return JSON.parse(extractJSON(rawText));
}

// =============================================
// СУММАРИЗАЦИЯ КОНТЕКСТА (п.3.4 «Память между шагами»)
// Генерирует context_summary 500-1000 токенов
// =============================================
export async function summarizeContext(
  previousSummary: string,
  currentStepData: Record<string, unknown>,
  structuredFacts: StructuredFacts
): Promise<string> {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1000,
    system: `Сожми данные проекта в краткое описание (500-1000 токенов).
Включи: тип проекта, проблема, цель, ключевые фичи, ограничения, пойманные противоречия.
НЕ ТЕРЯЙ конкретику: числа, имена, технические термины.`,
    messages: [{
      role: 'user',
      content: `Предыдущий контекст:\n${previousSummary}\n\nНовые данные:\n${JSON.stringify(currentStepData)}\n\nФакты:\n${JSON.stringify(structuredFacts)}`
    }],
  });

  return response.content
    .filter(block => block.type === 'text')
    .map(block => block.type === 'text' ? block.text : '')
    .join('');
}

// =============================================
// УТИЛИТЫ
// =============================================
function fillTemplate(template: string, vars: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
  }
  return result;
}

function parseAIResponse(raw: string): AIResponse {
  try {
    const json = JSON.parse(extractJSON(raw));
    return {
      message: json.message || '',
      extracted_data: json.extracted_data || {},
      updated_facts: json.updated_facts || {},
      contradictions: json.contradictions || [],
      step_complete: json.step_complete || false,
      open_questions: json.open_questions || [],
      updated_summary: json.updated_summary,
    };
  } catch {
    // Fallback: если AI не вернул JSON — оборачиваем текст
    return {
      message: raw,
      extracted_data: {},
      updated_facts: {},
      contradictions: [],
      step_complete: false,
      open_questions: [],
    };
  }
}

function extractJSON(text: string): string {
  // Убираем markdown-обёртку ```json ... ```
  const match = text.match(/```json\s*([\s\S]*?)\s*```/);
  if (match) return match[1].trim();
  // Ищем первый { ... }
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start !== -1 && end !== -1) return text.slice(start, end + 1);
  return text;
}
