// Brief AI — Репозиторий: Документы ТЗ
import { query, queryOne } from '../index';

export interface BriefDocument {
  id: string;
  project_id: string;
  sections: Record<string, unknown>;
  open_questions: unknown[];
  completeness_score: number;
  user_overrides: unknown[];
  version: number;
  exported_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export async function createDocument(data: {
  project_id: string;
  sections: Record<string, unknown>;
  open_questions?: unknown[];
  completeness_score?: number;
  user_overrides?: unknown[];
}): Promise<BriefDocument> {
  const result = await queryOne<BriefDocument>(
    `INSERT INTO brief_documents (project_id, sections, open_questions, completeness_score, user_overrides)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [
      data.project_id,
      JSON.stringify(data.sections),
      JSON.stringify(data.open_questions || []),
      data.completeness_score || 0,
      JSON.stringify(data.user_overrides || []),
    ]
  );
  return result!;
}

export async function getDocument(id: string): Promise<BriefDocument | null> {
  return queryOne<BriefDocument>('SELECT * FROM brief_documents WHERE id = $1', [id]);
}

export async function getDocumentByProject(projectId: string): Promise<BriefDocument | null> {
  return queryOne<BriefDocument>(
    'SELECT * FROM brief_documents WHERE project_id = $1',
    [projectId]
  );
}

export async function updateDocument(
  id: string,
  data: {
    sections?: Record<string, unknown>;
    open_questions?: unknown[];
    completeness_score?: number;
    user_overrides?: unknown[];
  }
): Promise<BriefDocument | null> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (data.sections !== undefined) {
    fields.push(`sections = $${paramIndex++}`);
    values.push(JSON.stringify(data.sections));
  }
  if (data.open_questions !== undefined) {
    fields.push(`open_questions = $${paramIndex++}`);
    values.push(JSON.stringify(data.open_questions));
  }
  if (data.completeness_score !== undefined) {
    fields.push(`completeness_score = $${paramIndex++}`);
    values.push(data.completeness_score);
  }
  if (data.user_overrides !== undefined) {
    fields.push(`user_overrides = $${paramIndex++}`);
    values.push(JSON.stringify(data.user_overrides));
  }

  if (fields.length === 0) return getDocument(id);

  fields.push(`version = version + 1`);
  fields.push(`updated_at = NOW()`);
  values.push(id);

  return queryOne<BriefDocument>(
    `UPDATE brief_documents SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
    values
  );
}

export async function updateSection(
  id: string,
  sectionKey: string,
  sectionData: unknown
): Promise<BriefDocument | null> {
  return queryOne<BriefDocument>(
    `UPDATE brief_documents
     SET sections = jsonb_set(sections, $1, $2),
         version = version + 1,
         updated_at = NOW()
     WHERE id = $3
     RETURNING *`,
    [`{${sectionKey}}`, JSON.stringify(sectionData), id]
  );
}

export async function markExported(id: string): Promise<void> {
  await query(
    `UPDATE brief_documents SET exported_at = NOW() WHERE id = $1`,
    [id]
  );
}
