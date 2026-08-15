/**
 * @vitest-environment node
 *
 * Regression: TRC-20 deposits must NOT be credited until they reach the required
 * on-chain confirmation count (fail-closed). Verifies getConfirmations() math and
 * that processIncomingTransaction() only credits a matured deposit.
 */
import { beforeEach, afterEach, vi, describe, it, expect } from 'vitest';

const mockTransaction = vi.fn();
const mockQuery = vi.fn();
const mockQueryOne = vi.fn();

vi.mock('../../db/pool', () => ({
  query: (...args: unknown[]) => mockQuery(...args),
  queryOne: (...args: unknown[]) => mockQueryOne(...args),
  transaction: (fn: (client: { query: typeof mockQuery }) => Promise<unknown>) => mockTransaction(fn),
}));
vi.mock('../../middleware/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const DEPOSIT_ADDR = 'TDepositAddr0000000000000000000000';

beforeEach(() => {
  process.env.USDT_TRC20_DEPOSIT_ADDRESS = DEPOSIT_ADDR;
  vi.resetModules();
});

afterEach(() => {
  mockTransaction.mockReset();
  mockQuery.mockReset();
  mockQueryOne.mockReset();
  vi.unstubAllGlobals();
});

/** Stub global fetch so getConfirmations sees txBlock and head block. */
function stubChain(txBlock: number, headBlock: number, ok = true) {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (String(url).includes('gettransactioninfobyid')) {
      return { ok, json: async () => ({ blockNumber: txBlock }) } as any;
    }
    if (String(url).includes('getnowblock')) {
      return { ok, json: async () => ({ block_header: { raw_data: { number: headBlock } } }) } as any;
    }
    return { ok: false, json: async () => ({}) } as any;
  }));
}

function makeTx() {
  return {
    transaction_id: '0xdeadbeef',
    to: DEPOSIT_ADDR,
    from: 'TSenderAddr',
    token_info: { decimals: 6 },
    value: '5000000', // 5 USDT
    block_timestamp: Date.now(),
  };
}

describe('getConfirmations', () => {
  it('computes head - tx + 1', async () => {
    stubChain(1000, 1019); // 1019 - 1000 + 1 = 20
    const { getConfirmations } = await import('../tronDepositMonitor');
    expect(await getConfirmations('0xabc')).toBe(20);
  });
  it('fails closed to 0 on API error or missing block', async () => {
    stubChain(0, 1019);
    const { getConfirmations } = await import('../tronDepositMonitor');
    expect(await getConfirmations('0xabc')).toBe(0);
  });
});

describe('processIncomingTransaction confirmation gate', () => {
  it('does NOT credit an under-confirmed deposit (5 < 20)', async () => {
    stubChain(1000, 1004); // 5 confirmations
    mockQueryOne.mockImplementation(async (sql: string) => {
      if (sql.includes('WHERE tx_hash = $1')) return null; // not seen before
      if (sql.includes("status = 'pending' AND tx_hash IS NULL")) return { id: 'dep-1', user_id: 'user-1' };
      return null;
    });
    mockQuery.mockResolvedValue({ rows: [{ id: 'dep-1' }], rowCount: 1 });

    const { processIncomingTransaction } = await import('../tronDepositMonitor');
    await processIncomingTransaction(makeTx());

    expect(mockTransaction).not.toHaveBeenCalled(); // no credit
    // It should record progress on the pending row without crediting
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE crypto_transactions'),
      expect.arrayContaining(['0xdeadbeef']),
    );
  });

  it('credits a matured deposit (20 >= 20)', async () => {
    stubChain(1000, 1019); // 20 confirmations
    mockQueryOne.mockImplementation(async (sql: string) => {
      if (sql.includes('WHERE tx_hash = $1')) return null;
      if (sql.includes("status = 'pending' AND tx_hash IS NULL")) return { id: 'dep-1', user_id: 'user-1' };
      return null;
    });
    mockQuery.mockResolvedValue({ rows: [], rowCount: 1 });
    mockTransaction.mockImplementation(async (fn: (c: unknown) => Promise<unknown>) =>
      fn({ query: vi.fn().mockResolvedValue({ rows: [], rowCount: 1 }) }));

    const { processIncomingTransaction } = await import('../tronDepositMonitor');
    await processIncomingTransaction(makeTx());

    expect(mockTransaction).toHaveBeenCalled(); // credited
  });
});
