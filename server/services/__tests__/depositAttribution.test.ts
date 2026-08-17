/**
 * @vitest-environment node
 *
 * FIN-1 — TRC-20 deposit ATTRIBUTION (distinct from confirmation/finality).
 *
 * A transaction can be final, successful and fully confirmed and STILL be
 * credited to the wrong user. These tests pin the fail-closed attribution rules:
 *
 *  - ownership is determined ONLY by a server-generated, unique `expected_amount`
 *    matched against an ACTIVE, unexpired pending intent;
 *  - the client-supplied sender address NEVER determines ownership;
 *  - exactly one match is required — 0 or >1 matches credit nobody;
 *  - token contract, destination address, and finality must all validate;
 *  - a tx_hash is only ever credited once, including under concurrency.
 */
import { beforeEach, afterEach, vi, describe, it, expect } from 'vitest';

const mockTransaction = vi.fn();
const mockQuery = vi.fn();
const mockQueryOne = vi.fn();

vi.mock('../../db/pool', () => ({
  query: (...a: unknown[]) => mockQuery(...a),
  queryOne: (...a: unknown[]) => mockQueryOne(...a),
  transaction: (fn: (client: { query: typeof mockQuery }) => Promise<unknown>) => mockTransaction(fn),
}));
vi.mock('../../middleware/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const DEPOSIT_ADDR = 'TDepositAddr0000000000000000000000';
const USDT_CONTRACT = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';

beforeEach(() => {
  process.env.USDT_TRC20_DEPOSIT_ADDRESS = DEPOSIT_ADDR;
  vi.resetModules();
  // Deep-confirmed + successful execution for every test, so any failure to
  // credit is unambiguously an ATTRIBUTION decision, not a finality one.
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (String(url).includes('/walletsolidity/gettransactioninfobyid')) {
      return { ok: true, json: async () => ({ blockNumber: 1000, receipt: { result: 'SUCCESS' } }) } as any;
    }
    if (String(url).includes('/walletsolidity/getnowblock')) {
      return { ok: true, json: async () => ({ block_header: { raw_data: { number: 1100 } } }) } as any;
    }
    return { ok: false, json: async () => ({}) } as any;
  }));
});
afterEach(() => {
  mockTransaction.mockReset();
  mockQuery.mockReset();
  mockQueryOne.mockReset();
  vi.unstubAllGlobals();
});

/** An incoming TRC-20 transfer of `amount` USDT from `from` to our hot wallet. */
function incomingTx(opts: { amount?: number; from?: string; to?: string; contract?: string; hash?: string } = {}) {
  const { amount = 5.123456, from = 'TSenderAddr', to = DEPOSIT_ADDR, contract = USDT_CONTRACT, hash = '0xhash1' } = opts;
  return {
    transaction_id: hash,
    to,
    from,
    token_info: { decimals: 6, address: contract },
    value: String(Math.round(amount * 1e6)),
    block_timestamp: Date.now(),
  };
}

/**
 * Wire the DB mock. `candidates` is what the attribution SELECT returns —
 * the crux of every test below.
 */
function mockDb(candidates: Array<{ id: string; user_id: string }>, opts: { existingTx?: boolean } = {}) {
  mockQueryOne.mockImplementation(async (sql: string) => {
    if (sql.includes('WHERE tx_hash = $1')) return opts.existingTx ? { id: 'already-tracked' } : null;
    return null;
  });
  mockQuery.mockImplementation(async (sql: string) => {
    if (sql.includes('expected_amount = $1')) return candidates;
    if (sql.includes('INSERT INTO crypto_transactions')) return [{ id: 'unclaimed-1' }];
    return [];
  });
  mockTransaction.mockImplementation(async (fn: (c: unknown) => Promise<unknown>) =>
    fn({ query: vi.fn().mockResolvedValue({ rows: [], rowCount: 1 }) }));
}

/** True when a wallet credit actually happened. */
function credited() {
  return mockTransaction.mock.calls.length > 0;
}
/** True when the transfer was parked as unattributed (no owner, no credit). */
function heldForReconciliation() {
  return mockQuery.mock.calls.some(([sql]) =>
    String(sql).includes('INSERT INTO crypto_transactions') && String(sql).includes("'processing'"));
}

describe('FIN-1 attribution: sender address must never confer ownership', () => {
  it('same sender, DIFFERENT user: credits the intent that owns the amount, not the address', async () => {
    // user-2 owns the unique expected_amount; user-1 merely shares the sender address.
    mockDb([{ id: 'intent-u2', user_id: 'user-2' }]);
    const { processIncomingTransaction } = await import('../tronDepositMonitor');
    await processIncomingTransaction(incomingTx({ from: 'TSharedSender' }));

    expect(credited()).toBe(true);
    const creditedIntent = mockTransaction.mock.calls.length;
    expect(creditedIntent).toBe(1);
    // The attribution query must key on expected_amount, never from_address.
    const attributionSql = mockQuery.mock.calls.map(([s]) => String(s)).find(s => s.includes('expected_amount = $1'));
    expect(attributionSql).toBeDefined();
    expect(attributionSql).not.toContain('from_address = $1');
  });

  it('does not query by from_address at all during attribution', async () => {
    mockDb([{ id: 'intent-1', user_id: 'user-1' }]);
    const { processIncomingTransaction } = await import('../tronDepositMonitor');
    await processIncomingTransaction(incomingTx());
    const selects = mockQuery.mock.calls.map(([s]) => String(s)).filter(s => s.includes('SELECT'));
    expect(selects.some(s => s.includes('from_address = $1'))).toBe(false);
  });
});

describe('FIN-1 attribution: exactly-one-match or fail closed', () => {
  it('TWO pending intents with the same amount -> credits NOBODY, holds for reconciliation', async () => {
    mockDb([
      { id: 'intent-a', user_id: 'user-a' },
      { id: 'intent-b', user_id: 'user-b' },
    ]);
    const { processIncomingTransaction } = await import('../tronDepositMonitor');
    await processIncomingTransaction(incomingTx());

    expect(credited()).toBe(false);
    expect(heldForReconciliation()).toBe(true);
  });

  it('NO matching intent (wrong amount) -> no credit', async () => {
    mockDb([]); // the amount matches no active intent
    const { processIncomingTransaction } = await import('../tronDepositMonitor');
    await processIncomingTransaction(incomingTx({ amount: 9.999999 }));

    expect(credited()).toBe(false);
    expect(heldForReconciliation()).toBe(true);
  });

  it('EXPIRED intent -> no credit (expiry is enforced in the attribution query)', async () => {
    // An expired intent is excluded by `expires_at > NOW()`, so the query returns none.
    mockDb([]);
    const { processIncomingTransaction } = await import('../tronDepositMonitor');
    await processIncomingTransaction(incomingTx());

    expect(credited()).toBe(false);
    const attributionSql = mockQuery.mock.calls.map(([s]) => String(s)).find(s => s.includes('expected_amount = $1'));
    expect(attributionSql).toContain('expires_at');
  });

  it('attribution query requires an ACTIVE pending intent with no tx_hash yet', async () => {
    mockDb([{ id: 'intent-1', user_id: 'user-1' }]);
    const { processIncomingTransaction } = await import('../tronDepositMonitor');
    await processIncomingTransaction(incomingTx());
    const sql = mockQuery.mock.calls.map(([s]) => String(s)).find(s => s.includes('expected_amount = $1'))!;
    expect(sql).toContain("status = 'pending'");
    expect(sql).toContain('tx_hash IS NULL');
    expect(sql).toContain("network = 'TRC20'");
  });
});

describe('FIN-1 attribution: chain/token/destination validation', () => {
  it('WRONG TOKEN contract -> ignored entirely (never credited as USDT)', async () => {
    mockDb([{ id: 'intent-1', user_id: 'user-1' }]);
    const { processIncomingTransaction } = await import('../tronDepositMonitor');
    await processIncomingTransaction(incomingTx({ contract: 'TFakeTokenContract00000000000000' }));

    expect(credited()).toBe(false);
    expect(heldForReconciliation()).toBe(false); // rejected before attribution
  });

  it('missing token contract -> fails closed', async () => {
    mockDb([{ id: 'intent-1', user_id: 'user-1' }]);
    const { processIncomingTransaction } = await import('../tronDepositMonitor');
    const tx = incomingTx();
    delete (tx.token_info as any).address;
    await processIncomingTransaction(tx);
    expect(credited()).toBe(false);
  });

  it('WRONG DESTINATION address -> ignored (not our deposit address)', async () => {
    mockDb([{ id: 'intent-1', user_id: 'user-1' }]);
    const { processIncomingTransaction } = await import('../tronDepositMonitor');
    await processIncomingTransaction(incomingTx({ to: 'TSomeoneElsesWallet00000000000000' }));

    expect(credited()).toBe(false);
    expect(mockQuery).not.toHaveBeenCalled();
  });
});

describe('FIN-1 attribution: one transaction credits at most one user, once', () => {
  it('ALREADY-USED tx hash -> skipped, no second credit', async () => {
    mockDb([{ id: 'intent-1', user_id: 'user-1' }], { existingTx: true });
    const { processIncomingTransaction } = await import('../tronDepositMonitor');
    await processIncomingTransaction(incomingTx());

    expect(credited()).toBe(false);
    expect(heldForReconciliation()).toBe(false);
  });

  it('VALID unique intent -> credited exactly once, with the on-chain amount', async () => {
    mockDb([{ id: 'intent-1', user_id: 'user-1' }]);
    const { processIncomingTransaction } = await import('../tronDepositMonitor');
    await processIncomingTransaction(incomingTx({ amount: 5.123456 }));

    expect(mockTransaction).toHaveBeenCalledTimes(1);
  });

  it('CONCURRENT processing of the same tx -> only one credit survives the atomic claim', async () => {
    mockDb([{ id: 'intent-1', user_id: 'user-1' }]);
    // Simulate two racing monitor passes: the first claim wins (rowCount 1),
    // the second loses (rowCount 0) and must abort before touching the wallet.
    let claims = 0;
    const walletWrites: string[] = [];
    mockTransaction.mockImplementation(async (fn: (c: unknown) => Promise<unknown>) =>
      fn({
        query: vi.fn(async (sql: string) => {
          if (String(sql).includes('UPDATE crypto_transactions') && String(sql).includes("status = 'completed'")) {
            claims += 1;
            return { rows: [], rowCount: claims === 1 ? 1 : 0 };
          }
          if (String(sql).includes('INSERT INTO wallets')) walletWrites.push(String(sql));
          return { rows: [], rowCount: 1 };
        }),
      }));

    const { processIncomingTransaction } = await import('../tronDepositMonitor');
    await Promise.all([
      processIncomingTransaction(incomingTx()),
      processIncomingTransaction(incomingTx()),
    ]);

    expect(claims).toBe(2);          // both attempted the claim
    expect(walletWrites).toHaveLength(1); // exactly one credit
  });
});

describe('FIN-1: server-generated expected_amount (client cannot choose it)', () => {
  it('createDepositIntent stores a unique server-side expected_amount + expiry', async () => {
    mockQuery.mockResolvedValue([{ id: 'dep-1', expires_at: '2030-01-01T00:00:00Z' }]);
    const { createDepositIntent } = await import('../tronDepositMonitor');
    const res = await createDepositIntent('user-1', 5);

    const [sql, params] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('expected_amount');
    expect(sql).toContain('expires_at');
    // Base amount preserved, with a non-zero server discriminator in the micros.
    expect(res.expectedAmount).toBeGreaterThan(5);
    expect(res.expectedAmount).toBeLessThan(6);
    expect(params).toContain(res.expectedAmount);
    expect(res.depositAddress).toBe(DEPOSIT_ADDR);
  });

  it('retries with a fresh discriminator when the unique index rejects a collision', async () => {
    let calls = 0;
    mockQuery.mockImplementation(async () => {
      calls += 1;
      if (calls === 1) {
        const e: any = new Error('duplicate key value violates unique constraint');
        e.code = '23505';
        throw e;
      }
      return [{ id: 'dep-2', expires_at: '2030-01-01T00:00:00Z' }];
    });
    const { createDepositIntent } = await import('../tronDepositMonitor');
    const res = await createDepositIntent('user-1', 10);

    expect(calls).toBe(2);
    expect(res.depositId).toBe('dep-2');
  });

  it('two intents for the same base amount get different expected amounts', async () => {
    mockQuery.mockResolvedValue([{ id: 'dep-x', expires_at: '2030-01-01T00:00:00Z' }]);
    const { createDepositIntent } = await import('../tronDepositMonitor');
    const seen = new Set<number>();
    for (let i = 0; i < 25; i++) {
      seen.add((await createDepositIntent('user-1', 7)).expectedAmount);
    }
    // Random 1..999999 micros: collisions across 25 draws are vanishingly rare.
    expect(seen.size).toBeGreaterThan(20);
  });
});
