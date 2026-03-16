// Brief AI — AI Service
// Стриминг, retry, FeatureCatalog, суммаризация, логирование

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
  user_overrides: string[];
}

export interface AIRequest {
  step_id: string;
  prompt_template: string;
  context_summary: string;
  structured_facts: StructuredFacts;
  user_answer: string;
  feature_catalog?: string;
  conversation_history?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

export interface AIResponse {
  message: string;
  extracted_data: Record<string, unknown>;
  updated_facts: Partial<StructuredFacts>;
  contradictions: Array<{ description: string; severity: 'warning' | 'critical' }>;
  step_complete: boolean;
  open_questions: string[];
  updated_summary?: string;
}

interface AICallLog {
  session_id?: string;
  step: string;
  input_tokens: number;
  output_tokens: number;
  latency_ms: number;
  model: string;
  success: boolean;
}

// Логирование вызовов Claude
function logAICall(log: AICallLog) {
  console.log(
    `[AI] ${log.step} | ${log.model} | in:${log.input_tokens} out:${log.output_tokens} | ${log.latency_ms}ms | ${log.success ? 'OK' : 'FAIL'}`
  );
}

// =============================================
// RETRY с exponential backoff
// =============================================
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: unknown) {
      lastError = error;
      const status = (error as { status?: number })?.status;

      // Retry только для 429 (rate limit) и 529 (overloaded)
      if (status === 429 || status === 529) {
        if (attempt < maxRetries) {
          const delay = baseDelay * Math.pow(2, attempt);
          console.warn(`[AI] Retry ${attempt + 1}/${maxRetries} after ${delay}ms (status: ${status})`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
      }
      throw error;
    }
  }

  throw lastError;
}

// =============================================
// ОСНОВНОЙ МЕТОД: обработка шага wizard
// =============================================
export async function processWizardStep(req: AIRequest): Promise<AIResponse> {
  const promptTemplate = PROMPT_MAP[req.prompt_template];
  if (!promptTemplate) {
    throw new Error(`Unknown prompt template: ${req.prompt_template}`);
  }

  const systemPrompt = fillTemplate(promptTemplate, {
    context_summary: req.context_summary || 'Первый шаг, контекста нет.',
    structured_facts: JSON.stringify(req.structured_facts, null, 2),
    project_type: req.structured_facts.project_type || 'не определён',
    feature_catalog: req.feature_catalog || '{}',
    feature_catalog_roles: req.feature_catalog || '{}',
  });

  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [
    ...(req.conversation_history || []),
    { role: 'user', content: req.user_answer },
  ];

  const startTime = Date.now();

  const response = await withRetry(async () => {
    // Таймаут 30 секунд
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    try {
      return await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        system: systemPrompt,
        messages: messages.map(m => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
      });
    } finally {
      clearTimeout(timeout);
    }
  });

  const latency = Date.now() - startTime;

  logAICall({
    step: req.step_id,
    input_tokens: response.usage.input_tokens,
    output_tokens: response.usage.output_tokens,
    latency_ms: latency,
    model: response.model,
    success: true,
  });

  const rawText = response.content
    .filter(block => block.type === 'text')
    .map(block => block.type === 'text' ? block.text : '')
    .join('');

  return parseAIResponse(rawText);
}

// =============================================
// СТРИМИНГ: обработка шага со стримингом
// =============================================
export async function processWizardStepStream(
  req: AIRequest,
  onChunk: (text: string) => void
): Promise<AIResponse> {
  const promptTemplate = PROMPT_MAP[req.prompt_template];
  if (!promptTemplate) {
    throw new Error(`Unknown prompt template: ${req.prompt_template}`);
  }

  const systemPrompt = fillTemplate(promptTemplate, {
    context_summary: req.context_summary || 'Первый шаг, контекста нет.',
    structured_facts: JSON.stringify(req.structured_facts, null, 2),
    project_type: req.structured_facts.project_type || 'не определён',
    feature_catalog: req.feature_catalog || '{}',
    feature_catalog_roles: req.feature_catalog || '{}',
  });

  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [
    ...(req.conversation_history || []),
    { role: 'user', content: req.user_answer },
  ];

  const startTime = Date.now();
  let fullText = '';

  const stream = await withRetry(async () =>
    client.messages.stream({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      system: systemPrompt,
      messages: messages.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    })
  );

  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      fullText += event.delta.text;
      onChunk(event.delta.text);
    }
  }

  const finalMessage = await stream.finalMessage();
  const latency = Date.now() - startTime;

  logAICall({
    step: req.step_id,
    input_tokens: finalMessage.usage.input_tokens,
    output_tokens: finalMessage.usage.output_tokens,
    latency_ms: latency,
    model: finalMessage.model,
    success: true,
  });

  return parseAIResponse(fullText);
}

// =============================================
// ПРОВЕРКА ПРОТИВОРЕЧИЙ
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

  const startTime = Date.now();

  const response = await withRetry(async () =>
    client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      system: prompt,
      messages: [{ role: 'user', content: 'Проведи проверку.' }],
    })
  );

  logAICall({
    step: 'contradiction_check',
    input_tokens: response.usage.input_tokens,
    output_tokens: response.usage.output_tokens,
    latency_ms: Date.now() - startTime,
    model: response.model,
    success: true,
  });

  const rawText = response.content
    .filter(block => block.type === 'text')
    .map(block => block.type === 'text' ? block.text : '')
    .join('');

  try {
    return JSON.parse(extractJSON(rawText));
  } catch {
    return { contradictions: [], missing_dependencies: [], overall_consistency_score: 100 };
  }
}

// =============================================
// ГЕНЕРАЦИЯ ФИНАЛЬНОГО ДОКУМЕНТА
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

  const startTime = Date.now();

  const response = await withRetry(async () =>
    client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8000,
      system: prompt,
      messages: [{ role: 'user', content: 'Сгенерируй техническое задание.' }],
    })
  );

  logAICall({
    step: 'document_generation',
    input_tokens: response.usage.input_tokens,
    output_tokens: response.usage.output_tokens,
    latency_ms: Date.now() - startTime,
    model: response.model,
    success: true,
  });

  const rawText = response.content
    .filter(block => block.type === 'text')
    .map(block => block.type === 'text' ? block.text : '')
    .join('');

  try {
    return JSON.parse(extractJSON(rawText));
  } catch {
    return { raw_text: rawText };
  }
}

// =============================================
// СУММАРИЗАЦИЯ КОНТЕКСТА
// =============================================
export async function summarizeContext(
  previousSummary: string,
  currentStepData: Record<string, unknown>,
  structuredFacts: StructuredFacts
): Promise<string> {
  const startTime = Date.now();

  const response = await withRetry(async () =>
    client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system: `Сожми данные проекта в краткое описание (500-1000 токенов).
Включи: тип проекта, проблема, цель, ключевые фичи, ограничения, пойманные противоречия.
НЕ ТЕРЯЙ конкретику: числа, имена, технические термины.`,
      messages: [{
        role: 'user',
        content: `Предыдущий контекст:\n${previousSummary || 'Нет'}\n\nНовые данные:\n${JSON.stringify(currentStepData)}\n\nФакты:\n${JSON.stringify(structuredFacts)}`
      }],
    })
  );

  logAICall({
    step: 'summarize',
    input_tokens: response.usage.input_tokens,
    output_tokens: response.usage.output_tokens,
    latency_ms: Date.now() - startTime,
    model: response.model,
    success: true,
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
  const match = text.match(/```json\s*([\s\S]*?)\s*```/);
  if (match) return match[1].trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start !== -1 && end !== -1) return text.slice(start, end + 1);
  return text;
}
