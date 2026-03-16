// Brief AI — Скрипт миграции БД
// Выполняет schema.sql через node-postgres

import { Pool } from 'pg';
import { readFileSync } from 'fs';
import { join } from 'path';

async function migrate() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://brief_ai:brief_ai_pass@localhost:5432/brief_ai',
  });

  try {
    console.log('[Migrate] Подключение к PostgreSQL...');
    await pool.query('SELECT NOW()');
    console.log('[Migrate] Подключено.');

    const schemaPath = join(__dirname, '..', 'prisma', 'schema.sql');
    const schema = readFileSync(schemaPath, 'utf-8');

    console.log('[Migrate] Применение схемы (9 таблиц)...');
    await pool.query(schema);
    console.log('[Migrate] Схема применена успешно.');

    // Проверка: подсчитываем таблицы
    const result = await pool.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    console.log(`[Migrate] Создано таблиц: ${result.rows.length}`);
    result.rows.forEach(row => console.log(`  - ${row.table_name}`));
  } catch (error) {
    console.error('[Migrate] Ошибка:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
