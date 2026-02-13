import { Pool } from 'pg';
import { logger } from '../middleware/logger';

const useSSL = process.env.DATABASE_SSL !== 'false' && (
  process.env.NODE_ENV === 'production' || (process.env.DATABASE_URL || '').includes('replit')
);

/** Minimal pool interface for type-safe usage when pg types resolve to BoundPool */
interface PoolLike {
  on(event: 'error', listener: (err: Error) => void): void;
  query(text: string, params?: any[]): Promise<{ rows: any[] }>;
  connect(): Promise<{
    query: (text: string, params?: any[]) => Promise<any>;
    release: () => void;
  }>;
  end?: () => Promise<void>;
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: useSSL ? { rejectUnauthorized: false } : false,
  max: Math.min(20, Math.max(2, parseInt(process.env.DB_POOL_MAX || '20', 10) || 20)),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
}) as unknown as PoolLike;

pool.on('error', (err) => {
  logger.error('Unexpected database pool error:', err);
});

export function isDatabaseConnectionError(error: any): boolean {
  if (!error) return false;
  const errorCode = error.code || '';
  const errorMessage = (error.message || '').toLowerCase();
  const connectionErrors = ['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'EHOSTUNREACH', 'ENETUNREACH'];
  const messagePatterns = ['connection refused', 'cannot connect', 'connection timed out', 'no pg_hba.conf entry', 'connection terminated unexpectedly', 'database system is starting up'];
  return connectionErrors.includes(errorCode) || messagePatterns.some(p => errorMessage.includes(p));
}

export async function query<T = any>(text: string, params?: any[]): Promise<T[]> {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    if (duration > 1000) {
      logger.warn(`Slow query (${duration}ms):`, text.substring(0, 100));
    }
    return result.rows;
  } catch (error) {
    logger.error('Database query error:', { text: text.substring(0, 100), error });
    throw error;
  }
}

export async function queryOne<T = any>(text: string, params?: any[]): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] || null;
}

export async function transaction<T>(callback: (client: Awaited<ReturnType<PoolLike['connect']>>) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}
