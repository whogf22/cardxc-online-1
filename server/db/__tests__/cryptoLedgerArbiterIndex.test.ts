/**
 * @vitest-environment node
 *
 * HIGH-2 — the unique arbiter index `uniq_crypto_ledger_source_transaction`
 * on `crypto_ledger_entries(source_transaction_id)` must exist before any money
 * path executes `ON CONFLICT (source_transaction_id) DO NOTHING`.
 *
 * Without the index, PostgreSQL raises SQLSTATE 42P10:
 *   "there is no unique or exclusion constraint matching the ON CONFLICT specification"
 *
 * This is a schema/invariant failure, not idempotency success.
 */
import { beforeAll, afterAll, beforeEach, describe, it, expect } from 'vitest';

let initializeDatabase: typeof import('../init')['initializeDatabase'];
let pool: typeof import('../pool')['pool'];

let testUserId: string;
let testOrderId: string;
let testTxId: string;
let testTxId2: string;

async function createTestUser(client: any) {
  const res = await client.query(
    `INSERT INTO users (email, password_hash, full_name, role)
     VALUES ($1, $2, $3, 'USER')
     RETURNING id`,
    [`test-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`, 'hash', 'Test User'],
  );
  return res.rows[0].id;
}

async function createTestTransaction(client: any, userId: string, amount = 100) {
  const res = await client.query(
    `INSERT INTO transactions (user_id, type, status, amount_cents, currency, description, reference)
     VALUES ($1, 'payment', 'SUCCESS', $2, 'USD', $3, $4)
     RETURNING id`,
    [userId, amount, 'test transaction', `ref-${Math.random().toString(36).slice(2)}`],
  );
  return res.rows[0].id;
}

async function createTestCardOrder(client: any, userId: string) {
  const res = await client.query(
    `INSERT INTO card_orders (user_id, target_user_id, amount_cents, currency, status)
     VALUES ($1, $1, 100, 'USD', 'PENDING')
     RETURNING id`,
    [userId],
  );
  return res.rows[0].id;
}

async function insertLedger(
  client: any,
  sourceTransactionId: string,
  sourceOrderId: string | null,
  amount = 100,
  description = 'test',
) {
  return client.query(
    `INSERT INTO crypto_ledger_entries (
      user_id, source_transaction_id, source_order_id, crypto_type,
      amount_cents, exchange_rate, usd_equivalent_cents, description
    ) VALUES ($1, $2, $3, 'USDT', $4, 1.0, $4, $5)
    ON CONFLICT (source_transaction_id) DO NOTHING`,
    [testUserId, sourceTransactionId, sourceOrderId, amount, description],
  );
}

async function resetCryptoLedger(client: any) {
  await client.query(`DROP INDEX IF EXISTS uniq_crypto_ledger_source_transaction`);
  await client.query(`DROP TABLE IF EXISTS crypto_ledger_entries CASCADE`);
}

describe('HIGH-2: crypto_ledger_entries source_transaction_id arbiter', () => {
  beforeAll(async () => {
    // Set the database target BEFORE any module that reads DATABASE_URL is
    // loaded, so the real pg pool points at the local test cluster.
    process.env.DATABASE_URL = 'postgres://postgres@localhost:5432/cardxc_test';
    process.env.DATABASE_SSL = 'false';

    ({ initializeDatabase } = await import('../init'));
    ({ pool } = await import('../pool'));

    const client = await pool.connect();
    try {
      await resetCryptoLedger(client);
    } finally {
      client.release();
    }
  });

  afterAll(async () => {
    await (pool as any).end?.();
  });

  beforeEach(async () => {
    const client = await pool.connect();
    try {
      await resetCryptoLedger(client);
      // Ensure a clean schema for every test.
      await initializeDatabase();
      testUserId = await createTestUser(client);
      testTxId = await createTestTransaction(client, testUserId, 100);
      testTxId2 = await createTestTransaction(client, testUserId, 200);
      testOrderId = await createTestCardOrder(client, testUserId);
    } finally {
      client.release();
    }
  });

  it('arbiter index exists -> ON CONFLICT (source_transaction_id) is a safe replay', async () => {
    const client = await pool.connect();
    try {
      const first = await insertLedger(client, testTxId, null, 100, 'withdrawal path');
      expect(first.rowCount).toBe(1);

      const second = await insertLedger(client, testTxId, null, 100, 'withdrawal path replay');
      expect(second.rowCount).toBe(0);

      const rows = await client.query(
        `SELECT * FROM crypto_ledger_entries WHERE source_transaction_id = $1`,
        [testTxId],
      );
      expect(rows.rows).toHaveLength(1);
    } finally {
      client.release();
    }
  });

  it('arbiter index absent -> ON CONFLICT raises SQLSTATE 42P10', async () => {
    const client = await pool.connect();
    try {
      await client.query(`DROP INDEX IF EXISTS uniq_crypto_ledger_source_transaction`);
      await expect(insertLedger(client, testTxId, null, 100, 'no index'))
        .rejects.toMatchObject({ code: '42P10' });
    } finally {
      client.release();
    }
  });

  it('duplicate historical source_transaction_id values prevent index creation and fail initialization loudly', async () => {
    const client = await pool.connect();
    try {
      // Drop the index so we can plant duplicates the way an older, un-indexed
      // schema would allow.
      await client.query(`DROP INDEX IF EXISTS uniq_crypto_ledger_source_transaction`);
      await client.query(
        `INSERT INTO crypto_ledger_entries (
          user_id, source_transaction_id, source_order_id, crypto_type,
          amount_cents, exchange_rate, usd_equivalent_cents, description
        ) VALUES ($1, $2, NULL, 'USDT', 100, 1.0, 100, 'duplicate A')`,
        [testUserId, testTxId],
      );
      await client.query(
        `INSERT INTO crypto_ledger_entries (
          user_id, source_transaction_id, source_order_id, crypto_type,
          amount_cents, exchange_rate, usd_equivalent_cents, description
        ) VALUES ($1, $2, NULL, 'USDT', 200, 1.0, 200, 'duplicate B')`,
        [testUserId, testTxId],
      );
    } finally {
      client.release();
    }

    // Re-running schema initialization must NOT swallow this. The duplicates
    // make `CREATE UNIQUE INDEX` fail, and the application must refuse to start.
    await expect(initializeDatabase()).rejects.toThrow(/uniq_crypto_ledger_source_transaction|could not create unique index|unique violation/i);
  });

  it('unrelated unique violation is not masked by ON CONFLICT (source_transaction_id)', async () => {
    const client = await pool.connect();
    try {
      // Plant a ledger row that violates the inline UNIQUE(source_order_id, user_id)
      // but has a different source_transaction_id.
      await client.query(
        `INSERT INTO crypto_ledger_entries (
          user_id, source_transaction_id, source_order_id, crypto_type,
          amount_cents, exchange_rate, usd_equivalent_cents, description
        ) VALUES ($1, $2, $3, 'USDT', 100, 1.0, 100, 'card order A')`,
        [testUserId, testTxId, testOrderId],
      );

      // Attempting to insert the same (source_order_id, user_id) with a different
      // source_transaction_id and an ON CONFLICT on source_transaction_id should
      // NOT be treated as success; the unrelated unique constraint must still fail.
      await expect(client.query(
        `INSERT INTO crypto_ledger_entries (
          user_id, source_transaction_id, source_order_id, crypto_type,
          amount_cents, exchange_rate, usd_equivalent_cents, description
        ) VALUES ($1, $2, $3, 'USDT', 200, 1.0, 200, 'card order B')
        ON CONFLICT (source_transaction_id) DO NOTHING`,
        [testUserId, testTxId2, testOrderId],
      )).rejects.toMatchObject({ code: '23505' });
    } finally {
      client.release();
    }
  });

  it('withdrawal ledger insert remains exactly-once with the arbiter', async () => {
    const client = await pool.connect();
    try {
      const sql = `INSERT INTO crypto_ledger_entries (
        user_id, source_transaction_id, crypto_type,
        amount_cents, exchange_rate, usd_equivalent_cents, description
      ) VALUES ($1, $2, 'USDT', $3, 1.0, $4, $5)
      ON CONFLICT (source_transaction_id) DO NOTHING`;

      const first = await client.query(sql, [testUserId, testTxId, -5000, -5000, 'USDT withdrawal to TAddr...']);
      expect(first.rowCount).toBe(1);

      const second = await client.query(sql, [testUserId, testTxId, -5000, -5000, 'USDT withdrawal to TAddr...']);
      expect(second.rowCount).toBe(0);
    } finally {
      client.release();
    }
  });

  it('gift-card USDT ledger insert remains exactly-once with the arbiter', async () => {
    const client = await pool.connect();
    try {
      const sql = `INSERT INTO crypto_ledger_entries (
        user_id, source_transaction_id, crypto_type,
        amount_cents, exchange_rate, usd_equivalent_cents, description
      ) VALUES ($1, $2, 'USDT', $3, 1.0, $4, $5)
      ON CONFLICT (source_transaction_id) DO NOTHING`;

      const first = await client.query(sql, [testUserId, testTxId, -2500, -2500, 'USDT payment for Amazon gift card']);
      expect(first.rowCount).toBe(1);

      const second = await client.query(sql, [testUserId, testTxId, -2500, -2500, 'USDT payment for Amazon gift card']);
      expect(second.rowCount).toBe(0);
    } finally {
      client.release();
    }
  });

  it('TRON deposit ledger insert remains exactly-once with the arbiter', async () => {
    const client = await pool.connect();
    try {
      const sql = `INSERT INTO crypto_ledger_entries (
        user_id, source_transaction_id, crypto_type,
        amount_cents, exchange_rate, usd_equivalent_cents, description
      ) VALUES ($1, $2, 'USDT', $3, 1.0, $4, $5)
      ON CONFLICT (source_transaction_id) DO NOTHING`;

      const first = await client.query(sql, [testUserId, testTxId, 10000, 10000, 'USDT TRC-20 deposit from TSender...']);
      expect(first.rowCount).toBe(1);

      const second = await client.query(sql, [testUserId, testTxId, 10000, 10000, 'USDT TRC-20 deposit from TSender...']);
      expect(second.rowCount).toBe(0);
    } finally {
      client.release();
    }
  });
});
