// Brief AI — Seed: загрузка FeatureCatalog в БД
// Источник: seed/feature-catalog.ts

import { Pool } from 'pg';
import { featureCatalogs } from '../seed/feature-catalog';

async function seed() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://brief_ai:brief_ai_pass@localhost:5432/brief_ai',
  });

  try {
    console.log('[Seed] Подключение к PostgreSQL...');
    await pool.query('SELECT NOW()');

    // Очистка каталога перед сидом
    await pool.query('DELETE FROM feature_catalogs');
    console.log('[Seed] Таблица feature_catalogs очищена.');

    let totalFeatures = 0;

    for (const catalog of featureCatalogs) {
      const features = catalog.features.map(f => ({
        ...f,
        typical_roles: catalog.typical_roles,
      }));

      await pool.query(
        `INSERT INTO feature_catalogs (project_type, features, version)
         VALUES ($1, $2, 1)`,
        [catalog.project_type, JSON.stringify({
          typical_roles: catalog.typical_roles,
          features: catalog.features,
        })]
      );

      totalFeatures += catalog.features.length;
      console.log(`[Seed] ${catalog.project_type}: ${catalog.features.length} фичей, ${catalog.typical_roles.length} ролей`);
    }

    console.log(`[Seed] Загружено ${totalFeatures} фичей для ${featureCatalogs.length} типов проектов.`);
  } catch (error) {
    console.error('[Seed] Ошибка:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seed();
