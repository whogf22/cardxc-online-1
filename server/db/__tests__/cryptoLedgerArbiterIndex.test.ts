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
    // Respect DATABASE_URL supplied by CI/local integration environments.
    // Only provide a passwordless local fallback when no target is configured.
    process.env.DATABASE_URL ||= 'postgres://postgres@localhost:5432/cardxc_test';
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
      await insertLedger(client, testTxId, testOrderId);
      await expect(insertLedger(client, testTxId, testOrderId)).resolves.toBeDefined();
      const count = await client.query(
        `SELECT COUNT(*)::int AS count FROM crypto_ledger_entries WHERE source_transaction_id = $1`,
        [testTxId],
      );
      expect(count.rows[0].count).toBe(1);
    } finally {
      client.release();
    }
  });

  it('arbiter index absent -> ON CONFLICT raises SQLSTATE 42P10', async () => {
    const client = await pool.connect();
    try {
      await client.query(`DROP INDEX uniq_crypto_ledger_source_transaction`);
      await expect(insertLedger(client, testTxId, testOrderId)).rejects.toMatchObject({ code: '42P10' });
    } finally {
      client.release();
    }
  });

  it('duplicate historical source_transaction_id values prevent index creation and fail initialization loudly', async () => {
    const client = await pool.connect();
    try {
      await client.query(`DROP INDEX uniq_crypto_ledger_source_transaction`);
      await client.query(
        `INSERT INTO crypto_ledger_entries (
          user_id, source_transaction_id, source_order_id, crypto_type,
          amount_cents, exchange_rate, usd_equivalent_cents, description
        ) VALUES
          ($1, $2, $3, 'USDT', 100, 1.0, 100, 'dup-1'),
          ($1, $2, $3, 'USDT', 100, 1.0, 100, 'dup-2')`,
        [testUserId, testTxId, testOrderId],
      );
      await expect(initializeDatabase()).rejects.toBeDefined();
    } finally {
      client.release();
    }
  });

  it('unrelated unique violation is not masked by ON CONFLICT (source_transaction_id)', async () => {
    const client = await pool.connect();
    try {
      await insertLedger(client, testTxId, testOrderId);
      await expect(insertLedger(client, testTxId2, testOrderId)).rejects.toMatchObject({ code: '23505' });
    } finally {
      client.release();
    }
  });

  it('withdrawal ledger insert remains exactly-once with the arbiter', async () => {
    const client = await pool.connect();
    try {
      await insertLedger(client, testTxId, null, -100, 'withdrawal');
      await insertLedger(client, testTxId, null, -100, 'withdrawal replay');
      const result = await client.query(
        `SELECT COUNT(*)::int AS count FROM crypto_ledger_entries WHERE source_transaction_id = $1`,
        [testTxId],
      );
      expect(result.rows[0].count).toBe(1);
    } finally {
      client.release();
    }
  });

  it('gift-card USDT ledger insert remains exactly-once with the arbiter', async () => {
    const client = await pool.connect();
    try {
      await insertLedger(client, testTxId, testOrderId, -100, 'gift-card');
      await insertLedger(client, testTxId, testOrderId, -100, 'gift-card replay');
      const result = await client.query(
        `SELECT COUNT(*)::int AS count FROM crypto_ledger_entries WHERE source_transaction_id = $1`,
        [testTxId],
      );
      expect(result.rows[0].count).toBe(1);
    } finally {
      client.release();
    }
  });

  it('TRON deposit ledger insert remains exactly-once with the arbiter', async () => {
    const client = await pool.connect();
    try {
      await insertLedger(client, testTxId, null, 100, 'tron deposit');
      await insertLedger(client, testTxId, null, 100, 'tron replay');
      const result = await client.query(
        `SELECT COUNT(*)::int AS count FROM crypto_ledger_entries WHERE source_transaction_id = $1`,
        [testTxId],
      );
      expect(result.rows[0].count).toBe(1);
    } finally {
      client.release();
    }
  });
});
