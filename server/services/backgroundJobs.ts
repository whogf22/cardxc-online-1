import cron from 'node-cron';
import { pool, query, queryOne } from '../db/pool';
import { logger } from '../middleware/logger';

export function initBackgroundJobs() {
  logger.info('Initializing background jobs');

  // Recurring transfers - every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    await processRecurringTransfers();
  });

  // Roundups - every hour
  cron.schedule('0 * * * *', async () => {
    await processRoundups();
  });

  // Cashback rewards - daily at midnight
  cron.schedule('0 0 * * *', async () => {
    await processCashbackRewards();
  });

  // Reset monthly budgets - 1st of each month
  cron.schedule('0 0 1 * *', async () => {
    await resetMonthlyBudgets();
  });

  // Database cleanup - every hour
  cron.schedule('0 * * * *', async () => {
    await cleanupExpiredData();
  });

  // Run cleanup immediately on startup
  setTimeout(async () => {
    try {
      await cleanupExpiredData();
    } catch (error) {
      logger.error('[BackgroundJobs] Initial cleanup failed:', error);
    }
  }, 5000);

  logger.info('Background jobs scheduled');
}

/**
 * Cleanup expired sessions, tokens, and stale data
 */
async function cleanupExpiredData() {
  try {
    const sessionsResult = await query(`
      UPDATE sessions SET is_active = FALSE 
      WHERE is_active = TRUE AND expires_at < NOW()
      RETURNING id
    `);
    if (sessionsResult.length > 0) {
      logger.info(`[Cleanup] Deactivated ${sessionsResult.length} expired sessions`);
    }

    const deletedSessions = await query(`
      DELETE FROM sessions WHERE is_active = FALSE AND expires_at < NOW() - INTERVAL '30 days'
      RETURNING id
    `);
    if (deletedSessions.length > 0) {
      logger.info(`[Cleanup] Deleted ${deletedSessions.length} old inactive sessions`);
    }

    const deletedSecurityEvents = await query(`
      DELETE FROM security_events WHERE created_at < NOW() - INTERVAL '90 days'
      RETURNING id
    `);
    if (deletedSecurityEvents.length > 0) {
      logger.info(`[Cleanup] Deleted ${deletedSecurityEvents.length} old security events`);
    }

    // Cleanup old login attempts (keep 7 days)
    await query(`
      DELETE FROM login_attempts WHERE created_at < NOW() - INTERVAL '7 days'
    `);

    // Cleanup expired password reset tokens
    await query(`
      DELETE FROM password_reset_tokens WHERE expires_at < NOW()
    `);

    // Cleanup expired email verification tokens if table exists (optional feature)
    try {
      await query(`
        DELETE FROM email_verification_tokens 
        WHERE expires_at < NOW() AND verified_at IS NULL
      `);
    } catch {
      // Table may not exist; ignore
    }

    // Mark expired payment links
    const linksResult = await query(`
      UPDATE payment_links SET status = 'expired' 
      WHERE status = 'active' AND expires_at < NOW()
      RETURNING id
    `);
    if (linksResult.length > 0) {
      logger.info(`[Cleanup] Expired ${linksResult.length} payment links`);
    }

    // Mark expired QR payment intents
    const qrResult = await query(`
      UPDATE qr_payment_intents SET status = 'expired' 
      WHERE status = 'pending' AND expires_at < NOW()
      RETURNING id
    `);
    if (qrResult.length > 0) {
      logger.info(`[Cleanup] Expired ${qrResult.length} QR payment intents`);
    }

    // Reset locked accounts after lockout period
    const unlockedResult = await query(`
      UPDATE users SET locked_until = NULL, failed_login_attempts = 0
      WHERE locked_until IS NOT NULL AND locked_until < NOW()
      RETURNING id, email
    `);
    if (unlockedResult.length > 0) {
      logger.info(`[Cleanup] Unlocked ${unlockedResult.length} accounts after lockout period`);
    }

    logger.debug('[Cleanup] Database cleanup completed successfully');
  } catch (err) {
    logger.error('[Cleanup] Error during database cleanup:', err);
  }
}

async function processRecurringTransfers() {
  try {
    const dueTransfers = await query(`
      SELECT rt.*, u.email as sender_email
      FROM recurring_transfers rt
      JOIN users u ON rt.user_id = u.id
      WHERE rt.status = 'active'
        AND rt.next_run_at <= NOW()
    `);

    for (const transfer of dueTransfers) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        const walletResult = await client.query(`
          SELECT id, balance_cents FROM wallets
          WHERE user_id = $1 AND currency = $2
          FOR UPDATE
        `, [transfer.user_id, transfer.currency]);
        const wallet = walletResult.rows[0];

        if (!wallet || wallet.balance_cents < transfer.amount_cents) {
          logger.warn(`[RecurringTransfer] Insufficient funds for transfer ${transfer.id}`);
          await client.query(`
            UPDATE recurring_transfers SET status = 'paused', updated_at = NOW()
            WHERE id = $1
          `, [transfer.id]);
          await client.query('COMMIT');
          continue;
        }

        const recipientId = transfer.recipient_id;
        if (!recipientId) {
          logger.warn(`[RecurringTransfer] Missing recipient_id for transfer ${transfer.id}`);
          await client.query(`
            UPDATE recurring_transfers SET status = 'failed', updated_at = NOW()
            WHERE id = $1
          `, [transfer.id]);
          await client.query('COMMIT');
          continue;
        }
        const recipientResult = await client.query(
          `SELECT id FROM users WHERE id = $1`,
          [recipientId]
        );
        const recipient = recipientResult.rows[0];

        if (!recipient) {
          logger.warn(`[RecurringTransfer] Recipient not found for transfer ${transfer.id}`);
          await client.query(`
            UPDATE recurring_transfers SET status = 'failed', updated_at = NOW()
            WHERE id = $1
          `, [transfer.id]);
          await client.query('COMMIT');
          continue;
        }

        const recipientName = transfer.recipient_name || 'user';

        await client.query(`
          UPDATE wallets SET balance_cents = balance_cents - $1 WHERE id = $2
        `, [transfer.amount_cents, wallet.id]);

        await client.query(`
          INSERT INTO wallets (user_id, currency, balance_cents)
          VALUES ($1, $2, $3)
          ON CONFLICT (user_id, currency)
          DO UPDATE SET balance_cents = wallets.balance_cents + $3
        `, [recipient.id, transfer.currency, transfer.amount_cents]);

        await client.query(`
          INSERT INTO transactions (user_id, type, amount_cents, currency, status, description)
          VALUES ($1, 'transfer_out', $2, $3, 'SUCCESS', $4)
        `, [transfer.user_id, transfer.amount_cents, transfer.currency, `Recurring transfer to ${recipientName}`]);

        let nextRun: Date;
        const now = new Date();
        switch (transfer.frequency) {
          case 'daily':
            nextRun = new Date(now.getTime());
            nextRun.setDate(nextRun.getDate() + 1);
            break;
          case 'weekly':
            nextRun = new Date(now.getTime());
            nextRun.setDate(nextRun.getDate() + 7);
            break;
          case 'biweekly':
            nextRun = new Date(now.getTime());
            nextRun.setDate(nextRun.getDate() + 14);
            break;
          case 'monthly':
            nextRun = new Date(now.getTime());
            nextRun.setMonth(nextRun.getMonth() + 1);
            break;
          default:
            nextRun = new Date(now.getTime());
            nextRun.setMonth(nextRun.getMonth() + 1);
        }

        await client.query(`
          UPDATE recurring_transfers
          SET next_run_at = $1, updated_at = NOW()
          WHERE id = $2
        `, [nextRun, transfer.id]);

        await client.query('COMMIT');
        logger.info(`[RecurringTransfer] Processed transfer ${transfer.id}`);
      } catch (err) {
        await client.query('ROLLBACK');
        logger.error(`[RecurringTransfer] Error processing transfer ${transfer.id}:`, err);
      } finally {
        client.release();
      }
    }
  } catch (err) {
    logger.error('[RecurringTransfer] Error fetching due transfers:', err);
  }
}

async function processRoundups() {
  try {
    const activeRules = await query(`
      SELECT rr.*, sv.id as vault_id
      FROM roundup_rules rr
      JOIN savings_vaults sv ON rr.vault_id = sv.id
      WHERE rr.enabled = TRUE
    `);

    for (const rule of activeRules) {
      const recentTxns = await query(`
        SELECT id, amount_cents FROM transactions
        WHERE user_id = $1
          AND type IN ('payment', 'purchase')
          AND status = 'SUCCESS'
          AND created_at > NOW() - INTERVAL '1 hour'
      `, [rule.user_id]);

      for (const txn of recentTxns) {
        const remainder = txn.amount_cents % 100;
        if (remainder > 0) {
          const roundupAmount = (100 - remainder) * (rule.multiplier || 1);

          const client = await pool.connect();
          try {
            await client.query('BEGIN');

            const walletResult = await client.query(`
              SELECT id, balance_cents FROM wallets
              WHERE user_id = $1 AND currency = 'USD'
              FOR UPDATE
            `, [rule.user_id]);
            const wallet = walletResult.rows[0];

            if (wallet && wallet.balance_cents >= roundupAmount) {
              await client.query(`
                UPDATE wallets SET balance_cents = balance_cents - $1 WHERE id = $2
              `, [roundupAmount, wallet.id]);

              await client.query(`
                UPDATE savings_vaults SET balance_cents = balance_cents + $1 WHERE id = $2
              `, [roundupAmount, rule.vault_id]);

              await client.query('COMMIT');
              logger.info(`[Roundup] Saved ${roundupAmount} cents for user ${rule.user_id}`);
            } else {
              await client.query('ROLLBACK');
            }
          } catch (err) {
            await client.query('ROLLBACK');
            logger.error(`[Roundup] Error processing transaction ${txn.id}:`, err);
          } finally {
            client.release();
          }
        }
      }
    }
  } catch (err) {
    logger.error('[Roundup] Error processing roundups:', err);
  }
}

async function processCashbackRewards() {
  try {
    const eligibleTxns = await query(`
      SELECT t.*, u.id as user_id
      FROM transactions t
      JOIN users u ON t.user_id = u.id
      WHERE t.type = 'purchase'
        AND t.status = 'SUCCESS'
        AND t.created_at > NOW() - INTERVAL '24 hours'
    `);

    for (const txn of eligibleTxns) {
      const cashbackRate = 0.01;
      const cashbackAmount = Math.floor(txn.amount_cents * cashbackRate);

      if (cashbackAmount > 0) {
        const existing = await queryOne<{ id: string }>(
          `SELECT id FROM reward_ledger WHERE transaction_id = $1 LIMIT 1`,
          [txn.id]
        );
        if (existing) continue;

        const client = await pool.connect();
        try {
          await client.query('BEGIN');

          await client.query(`
            INSERT INTO reward_ledger (user_id, transaction_id, cashback_cents, description, status)
            VALUES ($1, $2, $3, $4, 'pending')
          `, [txn.user_id, txn.id, cashbackAmount, `Cashback on purchase ${txn.id}`]);

          await client.query('COMMIT');
          logger.info(`[Cashback] Awarded ${cashbackAmount} cents to user ${txn.user_id}`);
        } catch (err) {
          await client.query('ROLLBACK');
          logger.error(`[Cashback] Error processing transaction ${txn.id}:`, err);
        } finally {
          client.release();
        }
      }
    }
  } catch (err) {
    logger.error('[Cashback] Error processing cashback:', err);
  }
}

async function resetMonthlyBudgets() {
  try {
    await query(`
      UPDATE budgets
      SET spent_cents = 0, updated_at = NOW()
      WHERE period = 'monthly'
    `);

    logger.info('[Budgets] Reset monthly budget spent amounts');
  } catch (err) {
    logger.error('[Budgets] Error resetting budgets:', err);
  }
}
