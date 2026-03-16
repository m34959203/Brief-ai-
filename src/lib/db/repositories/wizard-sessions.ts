// Brief AI — Репозиторий: Wizard-сессии
import { query, queryOne } from '../index';
import type { StructuredFacts } from '@/lib/ai/ai-service';

export interface WizardSession {
  id: string;
  project_id: string;
  current_step: number;
  mode: 'text' | 'voice';
  context_summary: string | null;
  structured_facts: StructuredFacts;
  started_at: Date;
  updated_at: Date;
}

const DEFAULT_FACTS: StructuredFacts = {
  project_type: null,
  platform: null,
  budget_constraint: null,
  must_features: [],
  auth_type: null,
  has_payments: false,
  target_users: [],
  contradictions_found: [],
  user_overrides: [],
};

export async function createSession(projectId: string): Promise<WizardSession> {
  const result = await queryOne<WizardSession>(
    `INSERT INTO wizard_sessions (project_id, current_step, mode, structured_facts)
     VALUES ($1, 1, 'text', $2)
     RETURNING *`,
    [projectId, JSON.stringify(DEFAULT_FACTS)]
  );
  return result!;
}

export async function getSession(id: string): Promise<WizardSession | null> {
  return queryOne<WizardSession>(
    'SELECT * FROM wizard_sessions WHERE id = $1',
    [id]
  );
}

export async function getSessionByProject(projectId: string): Promise<WizardSession | null> {
  return queryOne<WizardSession>(
    'SELECT * FROM wizard_sessions WHERE project_id = $1',
    [projectId]
  );
}

export async function updateSession(
  id: string,
  data: {
    current_step?: number;
    mode?: 'text' | 'voice';
    context_summary?: string;
    structured_facts?: StructuredFacts;
  }
): Promise<WizardSession | null> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (data.current_step !== undefined) {
    fields.push(`current_step = $${paramIndex++}`);
    values.push(data.current_step);
  }
  if (data.mode !== undefined) {
    fields.push(`mode = $${paramIndex++}`);
    values.push(data.mode);
  }
  if (data.context_summary !== undefined) {
    fields.push(`context_summary = $${paramIndex++}`);
    values.push(data.context_summary);
  }
  if (data.structured_facts !== undefined) {
    fields.push(`structured_facts = $${paramIndex++}`);
    values.push(JSON.stringify(data.structured_facts));
  }

  if (fields.length === 0) return getSession(id);

  fields.push(`updated_at = NOW()`);
  values.push(id);

  return queryOne<WizardSession>(
    `UPDATE wizard_sessions SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
    values
  );
}

export async function updateStructuredFacts(
  id: string,
  facts: StructuredFacts
): Promise<void> {
  await query(
    `UPDATE wizard_sessions SET structured_facts = $1, updated_at = NOW() WHERE id = $2`,
    [JSON.stringify(facts), id]
  );
}

export async function updateContextSummary(
  id: string,
  summary: string
): Promise<void> {
  await query(
    `UPDATE wizard_sessions SET context_summary = $1, updated_at = NOW() WHERE id = $2`,
    [summary, id]
  );
}
