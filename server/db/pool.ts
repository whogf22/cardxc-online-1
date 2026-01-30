import { Pool } from 'pg';
import { logger } from '../middleware/logger';

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000, // Increased for stability
});

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

export async function transaction<T>(callback: (client: any) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
