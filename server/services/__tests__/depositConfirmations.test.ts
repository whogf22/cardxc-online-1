/**
 * @vitest-environment node
 *
 * Full confirmation/finality matrix for the TRC-20 deposit monitor.
 *
 * Invariants:
 *  - Confirmations are computed from SOLIDIFIED (irreversible) chain state
 *    (/walletsolidity/*), and the tx must have executed successfully.
 *  - A deposit is NEVER credited below REQUIRED_CONFIRMATIONS (20) — enforced at
 *    the gate AND defensively inside creditUserDeposit.
 *  - Idempotency + concurrent double-credit protection are preserved.
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
const REQUIRED = 20;

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

/**
 * Stub SolidityNode endpoints. `info` controls gettransactioninfobyid; `head`
 * controls getnowblock. Either can be forced to a non-200 (ok:false).
 */
function stubSolidity(opts: {
  infoOk?: boolean;
  blockNumber?: number | undefined;
  result?: string; // receipt.result
  omitResult?: boolean; // simulate a receipt with no result field
  headOk?: boolean;
  headNumber?: number | undefined;
}) {
  const {
    infoOk = true, blockNumber, result = 'SUCCESS', omitResult = false, headOk = true, headNumber,
  } = opts;
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (String(url).includes('/walletsolidity/gettransactioninfobyid')) {
      return {
        ok: infoOk,
        json: async () => (blockNumber === undefined ? {} : { blockNumber, receipt: omitResult ? {} : { result } }),
      } as any;
    }
    if (String(url).includes('/walletsolidity/getnowblock')) {
      return {
        ok: headOk,
        json: async () => (headNumber === undefined ? {} : { block_header: { raw_data: { number: headNumber } } }),
      } as any;
    }
    return { ok: false, json: async () => ({}) } as any;
  }));
}

const USDT_CONTRACT = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';

function makeTx() {
  // token_info.address is required post-FIN-1: a transfer whose contract is not
  // USDT-TRC20 is rejected before attribution.
  return { transaction_id: '0xdeadbeef', to: DEPOSIT_ADDR, from: 'TSenderAddr', token_info: { decimals: 6, address: USDT_CONTRACT }, value: '5000000', block_timestamp: Date.now() };
}

// ── getConfirmations matrix ────────────────────────────────────────────────
describe('getConfirmations (SolidityNode + success)', () => {
  const cases: Array<[string, Parameters<typeof stubSolidity>[0], number]> = [
    ['0 confirmations (not solidified: no blockNumber)', { blockNumber: undefined }, 0],
    ['1 confirmation', { blockNumber: 1000, headNumber: 1000 }, 1],
    ['threshold-1 (19)', { blockNumber: 1000, headNumber: 1018 }, 19],
    ['threshold (20)', { blockNumber: 1000, headNumber: 1019 }, 20],
    ['above threshold (25)', { blockNumber: 1000, headNumber: 1024 }, 25],
    ['API failure (info non-200)', { infoOk: false, blockNumber: 1000, headNumber: 1024 }, 0],
    ['malformed block info (no head number)', { blockNumber: 1000, headNumber: undefined }, 0],
    ['failed transaction (receipt REVERT)', { blockNumber: 1000, headNumber: 1024, result: 'REVERT' }, 0],
    ['ambiguous result (missing receipt.result)', { blockNumber: 1000, headNumber: 1024, omitResult: true }, 0],
  ];
  for (const [name, opts, expected] of cases) {
    it(name + ` -> ${expected}`, async () => {
      stubSolidity(opts);
      const { getConfirmations } = await import('../tronDepositMonitor');
      expect(await getConfirmations('0xabc')).toBe(expected);
    });
  }

  it('RPC transport failure (fetch throws) -> 0 (fail closed)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('ECONNREFUSED'); }));
    const { getConfirmations } = await import('../tronDepositMonitor');
    expect(await getConfirmations('0xabc')).toBe(0);
  });

  it('malformed RPC payload (json() throws) -> 0 (fail closed)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => { throw new SyntaxError('Unexpected token'); } } as any)));
    const { getConfirmations } = await import('../tronDepositMonitor');
    expect(await getConfirmations('0xabc')).toBe(0);
  });

  it('head-block RPC failure (getnowblock non-200) -> 0 even when tx info is valid', async () => {
    stubSolidity({ blockNumber: 1000, headNumber: 1024, headOk: false });
    const { getConfirmations } = await import('../tronDepositMonitor');
    expect(await getConfirmations('0xabc')).toBe(0);
  });

  it('head block BEHIND the tx block (inconsistent chain view) -> 0', async () => {
    stubSolidity({ blockNumber: 2000, headNumber: 1000 });
    const { getConfirmations } = await import('../tronDepositMonitor');
    expect(await getConfirmations('0xabc')).toBe(0);
  });

  it('uses the SolidityNode endpoints (not FullNode)', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ blockNumber: 1, receipt: { result: 'SUCCESS' }, block_header: { raw_data: { number: 20 } } }) } as any));
    vi.stubGlobal('fetch', fetchMock);
    const { getConfirmations } = await import('../tronDepositMonitor');
    await getConfirmations('0xabc');
    const urls = fetchMock.mock.calls.map((c: any[]) => String(c[0]));
    expect(urls.some(u => u.includes('/walletsolidity/gettransactioninfobyid'))).toBe(true);
    expect(urls.some(u => u.includes('/walletsolidity/getnowblock'))).toBe(true);
    expect(urls.some(u => u.includes('/wallet/gettransactioninfobyid'))).toBe(false);
  });
});

// ── processIncomingTransaction gate ────────────────────────────────────────
describe('processIncomingTransaction confirmation gate', () => {
  // Post-FIN-1 the pending intent is resolved by the server-generated
  // expected_amount (via `query`, returning rows), not by from_address.
  function mockPending() {
    mockQueryOne.mockImplementation(async (sql: string) => {
      if (sql.includes('WHERE tx_hash = $1')) return null;
      return null;
    });
    mockQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('expected_amount = $1')) return [{ id: 'dep-1', user_id: 'user-1' }];
      return [];
    });
  }

  it('does NOT credit under threshold (19) — records progress only', async () => {
    stubSolidity({ blockNumber: 1000, headNumber: 1018 }); // 19
    mockPending();
    const { processIncomingTransaction } = await import('../tronDepositMonitor');
    await processIncomingTransaction(makeTx());
    expect(mockTransaction).not.toHaveBeenCalled();
    expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('UPDATE crypto_transactions'), expect.arrayContaining(['0xdeadbeef']));
  });

  it('credits at threshold (20)', async () => {
    stubSolidity({ blockNumber: 1000, headNumber: 1019 }); // 20
    mockPending();
    mockTransaction.mockImplementation(async (fn: (c: unknown) => Promise<unknown>) =>
      fn({ query: vi.fn().mockResolvedValue({ rows: [], rowCount: 1 }) }));
    const { processIncomingTransaction } = await import('../tronDepositMonitor');
    await processIncomingTransaction(makeTx());
    expect(mockTransaction).toHaveBeenCalled();
  });

  it('does NOT credit a failed (reverted) transaction even if block-deep', async () => {
    stubSolidity({ blockNumber: 1000, headNumber: 1024, result: 'REVERT' }); // 0 conf
    mockPending();
    const { processIncomingTransaction } = await import('../tronDepositMonitor');
    await processIncomingTransaction(makeTx());
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('duplicate poll: an already-tracked tx_hash is skipped (no credit)', async () => {
    stubSolidity({ blockNumber: 1000, headNumber: 1024 });
    mockQueryOne.mockImplementation(async (sql: string) => {
      if (sql.includes('WHERE tx_hash = $1')) return { id: 'existing' };
      return null;
    });
    const { processIncomingTransaction } = await import('../tronDepositMonitor');
    await processIncomingTransaction(makeTx());
    expect(mockTransaction).not.toHaveBeenCalled();
  });
});

// ── creditUserDeposit: defensive threshold, concurrency, rollback ──────────
describe('creditUserDeposit safety', () => {
  function makeClient(executed: string[], claimRowCount: number, throwOnWallet = false) {
    return {
      query: vi.fn(async (sql: string) => {
        executed.push(sql);
        if (sql.includes('UPDATE crypto_transactions') && sql.includes("status = 'completed'")) {
          return { rows: [], rowCount: claimRowCount };
        }
        if (throwOnWallet && sql.includes('INSERT INTO wallets')) {
          throw new Error('DB_WRITE_FAILED');
        }
        return { rows: [], rowCount: 1 };
      }),
    };
  }

  it('defensively refuses to credit below the threshold (confirmations=5)', async () => {
    const executed: string[] = [];
    mockTransaction.mockImplementation(async (fn: (c: unknown) => Promise<unknown>) => fn(makeClient(executed, 1)));
    const { creditUserDeposit } = await import('../tronDepositMonitor');
    await expect(creditUserDeposit('user-1', 'dep-1', '0xabc', 5, 'TSender', Date.now(), 5)).rejects.toThrow('INSUFFICIENT_CONFIRMATIONS');
    expect(mockTransaction).not.toHaveBeenCalled();
    expect(executed.some(s => s.includes('INSERT INTO wallets'))).toBe(false);
  });

  it('credits when confirmations meet the threshold', async () => {
    const executed: string[] = [];
    mockTransaction.mockImplementation(async (fn: (c: unknown) => Promise<unknown>) => fn(makeClient(executed, 1)));
    const { creditUserDeposit } = await import('../tronDepositMonitor');
    await creditUserDeposit('user-1', 'dep-1', '0xabc', 5, 'TSender', Date.now(), REQUIRED);
    expect(executed.some(s => s.includes('INSERT INTO wallets'))).toBe(true);
  });

  it('concurrent claim lost (rowCount 0) -> benign no-op, no double credit', async () => {
    const executed: string[] = [];
    mockTransaction.mockImplementation(async (fn: (c: unknown) => Promise<unknown>) => fn(makeClient(executed, 0)));
    const { creditUserDeposit } = await import('../tronDepositMonitor');
    await expect(creditUserDeposit('user-1', 'dep-1', '0xabc', 5, 'TSender', Date.now(), REQUIRED)).resolves.toBeUndefined();
    expect(executed.some(s => s.includes('INSERT INTO wallets'))).toBe(false);
    expect(executed.some(s => s.includes('crypto_ledger_entries'))).toBe(false);
  });

  it('rollback: a mid-transaction failure aborts (throws, no benign swallow)', async () => {
    const executed: string[] = [];
    mockTransaction.mockImplementation(async (fn: (c: unknown) => Promise<unknown>) => fn(makeClient(executed, 1, true)));
    const { creditUserDeposit } = await import('../tronDepositMonitor');
    await expect(creditUserDeposit('user-1', 'dep-1', '0xabc', 5, 'TSender', Date.now(), REQUIRED)).rejects.toThrow('DB_WRITE_FAILED');
  });
});
