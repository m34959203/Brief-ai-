// Brief AI — Репозиторий: Каталог фичей
import { queryOne } from '../index';

export interface FeatureCatalog {
  id: string;
  project_type: string;
  features: unknown;
  version: number;
  created_at: Date;
}

export async function getCatalogByType(projectType: string): Promise<FeatureCatalog | null> {
  return queryOne<FeatureCatalog>(
    'SELECT * FROM feature_catalogs WHERE project_type = $1 ORDER BY version DESC LIMIT 1',
    [projectType]
  );
}
