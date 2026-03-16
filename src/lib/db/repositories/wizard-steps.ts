// Brief AI — Репозиторий: Шаги Wizard
import { query, queryOne } from '../index';

export interface WizardStep {
  id: string;
  session_id: string;
  step_number: number;
  status: 'pending' | 'active' | 'completed';
  ai_questions: unknown;
  user_answers: unknown;
  extracted_data: unknown;
  ai_calls_count: number;
  duration_sec: number | null;
  created_at: Date;
  updated_at: Date;
}

export async function createStep(data: {
  session_id: string;
  step_number: number;
  status?: string;
}): Promise<WizardStep> {
  const result = await queryOne<WizardStep>(
    `INSERT INTO wizard_steps (session_id, step_number, status)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [data.session_id, data.step_number, data.status || 'pending']
  );
  return result!;
}

export async function createAllSteps(sessionId: string, stepCount: number = 6): Promise<WizardStep[]> {
  const values: unknown[] = [];
  const placeholders: string[] = [];

  for (let i = 1; i <= stepCount; i++) {
    const offset = (i - 1) * 3;
    placeholders.push(`($${offset + 1}, $${offset + 2}, $${offset + 3})`);
    values.push(sessionId, i, i === 1 ? 'active' : 'pending');
  }

  const result = await query<WizardStep>(
    `INSERT INTO wizard_steps (session_id, step_number, status)
     VALUES ${placeholders.join(', ')}
     RETURNING *`,
    values
  );
  return result.rows;
}

export async function getStepsBySession(sessionId: string): Promise<WizardStep[]> {
  const result = await query<WizardStep>(
    'SELECT * FROM wizard_steps WHERE session_id = $1 ORDER BY step_number',
    [sessionId]
  );
  return result.rows;
}

export async function getStep(sessionId: string, stepNumber: number): Promise<WizardStep | null> {
  return queryOne<WizardStep>(
    'SELECT * FROM wizard_steps WHERE session_id = $1 AND step_number = $2',
    [sessionId, stepNumber]
  );
}

export async function updateStep(
  sessionId: string,
  stepNumber: number,
  data: {
    status?: string;
    ai_questions?: unknown;
    user_answers?: unknown;
    extracted_data?: unknown;
    ai_calls_count?: number;
    duration_sec?: number;
  }
): Promise<WizardStep | null> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (data.status !== undefined) {
    fields.push(`status = $${paramIndex++}`);
    values.push(data.status);
  }
  if (data.ai_questions !== undefined) {
    fields.push(`ai_questions = $${paramIndex++}`);
    values.push(JSON.stringify(data.ai_questions));
  }
  if (data.user_answers !== undefined) {
    fields.push(`user_answers = $${paramIndex++}`);
    values.push(JSON.stringify(data.user_answers));
  }
  if (data.extracted_data !== undefined) {
    fields.push(`extracted_data = $${paramIndex++}`);
    values.push(JSON.stringify(data.extracted_data));
  }
  if (data.ai_calls_count !== undefined) {
    fields.push(`ai_calls_count = $${paramIndex++}`);
    values.push(data.ai_calls_count);
  }
  if (data.duration_sec !== undefined) {
    fields.push(`duration_sec = $${paramIndex++}`);
    values.push(data.duration_sec);
  }

  if (fields.length === 0) return getStep(sessionId, stepNumber);

  fields.push(`updated_at = NOW()`);
  values.push(sessionId, stepNumber);

  return queryOne<WizardStep>(
    `UPDATE wizard_steps SET ${fields.join(', ')}
     WHERE session_id = $${paramIndex} AND step_number = $${paramIndex + 1}
     RETURNING *`,
    values
  );
}
