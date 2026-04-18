import { query } from './pool';
import { logger } from '../middleware/logger';

/**
 * Database Optimization & Performance Tuning
 * Run this after initial setup to optimize queries and indexes
 */

export async function optimizeDatabase() {
  try {
    logger.info('database_optimization_started');

    // 1. Create indexes for frequently queried columns
    await createOptimizationIndexes();

    // 2. Analyze tables for query planner
    await analyzeTables();

    // 3. Vacuum and optimize storage
    await vacuumTables();

    // 4. Set up connection pooling parameters
    await optimizeConnectionPool();

    logger.info('database_optimization_completed');
  } catch (error) {
    logger.error('database_optimization_error', { error });
    throw error;
  }
}

async function createOptimizationIndexes() {
  logger.info('creating_optimization_indexes');

  const indexes = [
    // Users table
    `CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`,
    `CREATE INDEX IF NOT EXISTS idx_users_email_verified ON users(email_verified)`,
    `CREATE INDEX IF NOT EXISTS idx_users_kyc_status ON users(kyc_status)`,

    // Wallets table
    `CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON wallets(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_wallets_currency ON wallets(currency)`,

    // Transactions table
    `CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status)`,
    `CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type)`,
    `CREATE INDEX IF NOT EXISTS idx_transactions_user_created ON transactions(user_id, created_at DESC)`,

    // Virtual Cards table
    `CREATE INDEX IF NOT EXISTS idx_virtual_cards_user_id ON virtual_cards(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_virtual_cards_status ON virtual_cards(status)`,
    `CREATE INDEX IF NOT EXISTS idx_virtual_cards_created_at ON virtual_cards(created_at DESC)`,

    // Card Orders table
    `CREATE INDEX IF NOT EXISTS idx_card_orders_user_id ON card_orders(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_card_orders_status ON card_orders(status)`,
    `CREATE INDEX IF NOT EXISTS idx_card_orders_created_at ON card_orders(created_at DESC)`,

    // Card Transactions table
    `CREATE INDEX IF NOT EXISTS idx_card_transactions_card_id ON card_transactions(card_id)`,
    `CREATE INDEX IF NOT EXISTS idx_card_transactions_created_at ON card_transactions(created_at DESC)`,

    // Gift Card Requests table
    `CREATE INDEX IF NOT EXISTS idx_gift_card_requests_user_id ON gift_card_requests(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_gift_card_requests_status ON gift_card_requests(status)`,
    `CREATE INDEX IF NOT EXISTS idx_gift_card_requests_created_at ON gift_card_requests(created_at DESC)`,

    // Deposit OTP table
    `CREATE INDEX IF NOT EXISTS idx_deposit_otps_user_id ON deposit_otps(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_deposit_otps_expires_at ON deposit_otps(expires_at)`,

    // Audit Logs table
    `CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC)`,

    // Payment Webhook Logs
    `CREATE INDEX IF NOT EXISTS idx_payment_webhook_logs_event_type ON payment_webhook_logs(event_type)`,
    `CREATE INDEX IF NOT EXISTS idx_payment_webhook_logs_processed ON payment_webhook_logs(processed)`,
  ];

  for (const indexQuery of indexes) {
    try {
      await query(indexQuery);
      logger.info('index_created', { query: indexQuery.substring(0, 50) });
    } catch (error) {
      logger.warn('index_creation_warning', { query: indexQuery.substring(0, 50), error });
    }
  }
}

async function analyzeTables() {
  logger.info('analyzing_tables');

  const tables = [
    'users',
    'wallets',
    'transactions',
    'virtual_cards',
    'card_orders',
    'card_transactions',
    'gift_card_requests',
    'deposit_otps',
    'audit_logs',
    'payment_webhook_logs',
  ];

  for (const table of tables) {
    try {
      await query(`ANALYZE ${table}`);
      logger.info('table_analyzed', { table });
    } catch (error) {
      logger.warn('table_analysis_warning', { table, error });
    }
  }
}

async function vacuumTables() {
  logger.info('vacuuming_tables');

  const tables = [
    'users',
    'wallets',
    'transactions',
    'virtual_cards',
    'card_orders',
    'card_transactions',
    'gift_card_requests',
    'deposit_otps',
    'audit_logs',
    'payment_webhook_logs',
  ];

  for (const table of tables) {
    try {
      await query(`VACUUM ANALYZE ${table}`);
      logger.info('table_vacuumed', { table });
    } catch (error) {
      logger.warn('table_vacuum_warning', { table, error });
    }
  }
}

async function optimizeConnectionPool() {
  logger.info('optimizing_connection_pool');

  // These are typically set in PostgreSQL config, but we can log recommendations
  const recommendations = {
    'max_connections': 200,
    'shared_buffers': '256MB',
    'effective_cache_size': '1GB',
    'work_mem': '4MB',
    'maintenance_work_mem': '64MB',
  };

  logger.info('connection_pool_recommendations', { recommendations });
}

/**
 * Get database statistics
 */
export async function getDatabaseStats() {
  try {
    const stats = {
      tableStats: [] as any[],
      indexStats: [] as any[],
      cacheHitRatio: 0,
    };

    // Get table sizes
    const tableSizes = await query(`
      SELECT 
        schemaname,
        tablename,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
        n_live_tup AS row_count
      FROM pg_stat_user_tables
      ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
    `);

    stats.tableStats = tableSizes;

    // Get index stats
    const indexStats = await query(`
      SELECT 
        schemaname,
        tablename,
        indexname,
        idx_scan AS scans,
        idx_tup_read AS tuples_read,
        idx_tup_fetch AS tuples_fetched
      FROM pg_stat_user_indexes
      ORDER BY idx_scan DESC
    `);

    stats.indexStats = indexStats;

    // Get cache hit ratio
    const cacheStats = await query(`
      SELECT 
        sum(heap_blks_read) as heap_read,
        sum(heap_blks_hit) as heap_hit,
        sum(heap_blks_hit) / (sum(heap_blks_hit) + sum(heap_blks_read)) as ratio
      FROM pg_statio_user_tables
    `);

    if (cacheStats[0]?.ratio) {
      stats.cacheHitRatio = parseFloat(cacheStats[0].ratio) * 100;
    }

    return stats;
  } catch (error) {
    logger.error('database_stats_error', { error });
    throw error;
  }
}

/**
 * Cleanup old data
 */
export async function cleanupOldData(daysToKeep: number = 90) {
  try {
    logger.info('cleanup_old_data_started', { daysToKeep });

    const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);

    // Delete old audit logs
    await query(`
      DELETE FROM audit_logs
      WHERE created_at < $1
    `, [cutoffDate]);

    // Delete old payment webhook logs
    await query(`
      DELETE FROM payment_webhook_logs
      WHERE created_at < $1
    `, [cutoffDate]);

    // Delete expired OTP records
    await query(`
      DELETE FROM deposit_otps 
      WHERE expires_at < NOW()
    `);

    logger.info('cleanup_old_data_completed');
  } catch (error) {
    logger.error('cleanup_old_data_error', { error });
    throw error;
  }
}

/**
 * Schedule regular optimization
 */
export function scheduleRegularOptimization() {
  // Run optimization every 24 hours
  setInterval(async () => {
    try {
      logger.info('scheduled_optimization_started');
      await cleanupOldData(90);
      await analyzeTables();
      logger.info('scheduled_optimization_completed');
    } catch (error) {
      logger.error('scheduled_optimization_error', { error });
    }
  }, 24 * 60 * 60 * 1000);

  logger.info('optimization_scheduler_initialized');
}
