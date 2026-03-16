// Brief AI — Слой доступа к данным
// PostgreSQL (pg.Pool) + Redis (ioredis)

import { Pool, type QueryResult, type QueryResultRow } from 'pg';
import Redis from 'ioredis';

// PostgreSQL пул соединений (max: 20)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('[DB] Unexpected pool error:', err);
});

// Redis клиент
let redis: Redis | null = null;

function getRedisClient(): Redis {
  if (!redis) {
    redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });
    redis.on('error', (err) => {
      console.error('[Redis] Connection error:', err);
    });
  }
  return redis;
}

// SQL-запрос с параметрами
export async function query<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  const start = Date.now();
  const result = await pool.query<T>(sql, params);
  const duration = Date.now() - start;
  if (duration > 1000) {
    console.warn(`[DB] Slow query (${duration}ms):`, sql.substring(0, 100));
  }
  return result;
}

// Получить одну строку
export async function queryOne<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  params?: unknown[]
): Promise<T | null> {
  const result = await query<T>(sql, params);
  return result.rows[0] || null;
}

// Получить Redis значение
export async function getRedis(key: string): Promise<string | null> {
  return getRedisClient().get(key);
}

// Установить Redis значение с TTL
export async function setRedis(key: string, value: string, ttlSec: number): Promise<void> {
  await getRedisClient().set(key, value, 'EX', ttlSec);
}

// Удалить Redis ключ
export async function delRedis(key: string): Promise<void> {
  await getRedisClient().del(key);
}

// Получить пул для транзакций
export function getPool(): Pool {
  return pool;
}

export { getRedisClient };
