// Brief AI — Репозиторий: Проекты
import { query, queryOne } from '../index';

export interface Project {
  id: string;
  user_id: string;
  title: string | null;
  brief_type: string;
  status: 'draft' | 'in_progress' | 'completed';
  template_id: string | null;
  created_at: Date;
  updated_at: Date;
}

export async function createProject(data: {
  user_id: string;
  brief_type: string;
  title?: string;
  template_id?: string;
}): Promise<Project> {
  const result = await queryOne<Project>(
    `INSERT INTO projects (user_id, brief_type, title, template_id)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [data.user_id, data.brief_type, data.title || null, data.template_id || null]
  );
  return result!;
}

export async function getProjectsByUser(userId: string): Promise<Project[]> {
  const result = await query<Project>(
    'SELECT * FROM projects WHERE user_id = $1 ORDER BY updated_at DESC',
    [userId]
  );
  return result.rows;
}

export async function getProjectById(id: string): Promise<Project | null> {
  return queryOne<Project>('SELECT * FROM projects WHERE id = $1', [id]);
}

export async function updateProject(
  id: string,
  data: Partial<Pick<Project, 'title' | 'status'>>
): Promise<Project | null> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (data.title !== undefined) {
    fields.push(`title = $${paramIndex++}`);
    values.push(data.title);
  }
  if (data.status !== undefined) {
    fields.push(`status = $${paramIndex++}`);
    values.push(data.status);
  }

  if (fields.length === 0) return getProjectById(id);

  fields.push(`updated_at = NOW()`);
  values.push(id);

  return queryOne<Project>(
    `UPDATE projects SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
    values
  );
}

export async function duplicateProject(id: string, userId: string): Promise<Project> {
  const original = await getProjectById(id);
  if (!original) throw new Error('Project not found');

  return createProject({
    user_id: userId,
    brief_type: original.brief_type,
    title: original.title ? `${original.title} (копия)` : undefined,
    template_id: original.template_id || undefined,
  });
}
