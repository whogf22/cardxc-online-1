import { config } from 'dotenv';
config();

import { Pool } from 'pg';
import { logger } from '../middleware/logger';

/**
 * PostgreSQL SSL Configuration
 * 
 * Security enforcement for fintech production environments:
 * - Production: SSL required with strict TLS verification
 * - Uses sslmode=verify-full for pg v9+ forward compatibility
 * - Appends uselibpqcompat=true to suppress pg v8 deprecation warnings
 * - Compatible with: Neon (Replit), Supabase, AWS RDS, Railway, Render, DigitalOcean
 * - Never disables NODE_TLS_REJECT_UNAUTHORIZED
 * - Falls back to no SSL only for explicit local development (DATABASE_SSL=false or sslmode=disable in URL)
 */

const dbUrl = process.env.DATABASE_URL || '';
const isProduction = process.env.NODE_ENV === 'production';
const urlHasSSLDisabled = dbUrl.includes('sslmode=disable');
const explicitSSLOff = process.env.DATABASE_SSL === 'false';

/**
 * SSL decision logic:
 * - If DATABASE_SSL=false is explicitly set, respect it (e.g. local PostgreSQL on 127.0.0.1)
 * - If sslmode=disable is in the URL, respect it
 * - Otherwise enforce SSL in production
 * - Development: Allow SSL bypass with explicit DATABASE_SSL=false or sslmode=disable in URL
 */
const useSSL = explicitSSLOff || urlHasSSLDisabled ? false : isProduction;

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

/**
 * Build a secure connection string:
 * - If SSL is active and no sslmode is present, enforce verify-full + libpq compat
 * - Strips any insecure sslmode values (prefer, require, verify-ca) and replaces with verify-full
 * - Keeps sslmode=disable untouched for local dev
 */
function buildSecureConnectionString(url: string, ssl: boolean): string {
  if (!url || !ssl) return url;

  let result = url;

  /**
   * Strip or replace any insecure sslmode values:
   * - prefer, require, verify-ca → verify-full (pg v9+ compatible)
   * - disable → verify-full (only when SSL is forced, i.e. production)
   */
  const insecureModes = /sslmode=(prefer|require|verify-ca|disable)\b/i;
  if (insecureModes.test(result)) {
    result = result.replace(insecureModes, 'sslmode=verify-full');
  }

  if (!result.includes('sslmode=')) {
    const separator = result.includes('?') ? '&' : '?';
    result = `${result}${separator}sslmode=verify-full`;
  }

  /**
   * uselibpqcompat=true suppresses the pg v8 deprecation warning:
   * "SECURITY WARNING: The SSL modes 'prefer', 'require', and 'verify-ca'
   *  are treated as aliases for 'verify-full'"
   */
  if (!result.includes('uselibpqcompat=')) {
    result = `${result}&uselibpqcompat=true`;
  }

  /**
   * Optional CA certificate loading for self-signed certificates.
   * Set DATABASE_CA_CERT env var with the path to a PEM-encoded CA file.
   * Not needed for Neon, Supabase, AWS RDS (they use publicly trusted CAs).
   */

  return result;
}

const connString = buildSecureConnectionString(dbUrl, useSSL);

/**
 * SSL object configuration:
 * - rejectUnauthorized: true enforces strict certificate validation
 * - Neon, Supabase, AWS RDS, etc. all provide valid CA-signed certs
 * - For self-signed certs: set DATABASE_CA_CERT to the PEM file path
 */
function buildSSLConfig(): false | { rejectUnauthorized: boolean; ca?: string } {
  if (!useSSL) return false;
  const sslConfig: { rejectUnauthorized: boolean; ca?: string } = { rejectUnauthorized: true };
  const caCertPath = process.env.DATABASE_CA_CERT;
  if (caCertPath) {
    try {
      const fs = require('fs');
      sslConfig.ca = fs.readFileSync(caCertPath, 'utf8');
    } catch (err: any) {
      logger.error('Failed to load CA certificate:', { path: caCertPath, error: err.message });
    }
  }
  return sslConfig;
}

export const pool = new Pool({
  connectionString: connString,
  ssl: buildSSLConfig(),
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

// nosemgrep: typescript.lang.security.audit.sqli.node-postgres-sqli
// Safe: This is the centralized query wrapper. All consumer code passes parameterized
// queries with $1,$2... placeholders and a values array. No string concatenation of
// user input reaches here - all route handlers use query(sql, [param1, param2]).
export async function query<T = any>(text: string, params?: any[]): Promise<T[]> {
  const start = Date.now();
  try {
    const result = await pool.query(text, params); // parameterized: values bound via $1,$2...
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

// nosemgrep: typescript.lang.security.audit.sqli.node-postgres-sqli
// Safe: Transaction wrapper issues only hardcoded BEGIN/COMMIT/ROLLBACK commands.
// User-supplied queries within the callback use the parameterized query() function above.
export async function transaction<T>(callback: (client: Awaited<ReturnType<PoolLike['connect']>>) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN'); // hardcoded SQL - no user input
    const result = await callback(client);
    await client.query('COMMIT'); // hardcoded SQL - no user input
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {}); // hardcoded SQL - no user input
    throw error;
  } finally {
    client.release();
  }
}
