/**
 * @vitest-environment node
 *
 * REGRESSION GUARD: the deposit monitor must bind the attribution amount to SQL
 * as an EXACT decimal STRING, never as a JS number.
 *
 * `expected_amount` is NUMERIC(20,8) and attribution uses exact equality
 * (`expected_amount = $1`). The old code computed
 * `Number(rawAmount) / Math.pow(10, decimals)` and bound that double, so above
 * 2^53 base units the low-order decimal digits — exactly where the FIN-1
 * discriminator lives — were silently lost.
 *
 * These tests exercise the MONITOR, not the helper: they assert on the parameter
 * the monitor actually hands to the SQL layer. Reverting the binding to
 * `Number(...)` fails them on BOTH the type assertion and the value assertion.
 *
 * There is deliberately NO tolerance/epsilon anywhere.
 */
import { beforeEach, afterEach, vi, describe, it, expect } from 'vitest';

const mockTransaction = vi.fn();
const mockQuery = vi.fn();
const mockQueryOne = vi.fn();

vi.mock('../../db/pool', () => ({
  query: (...a: unknown[]) => mockQuery(...a),
  queryOne: (...a: unknown[]) => mockQueryOne(...a),
  transaction: (fn: (c: { query: typeof mockQuery }) => Promise<unknown>) => mockTransaction(fn),
}));
vi.mock('../../middleware/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const DEPOSIT_ADDR = 'TDepositAddr0000000000000000000000';
const USDT_CONTRACT = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';

beforeEach(() => {
  process.env.USDT_TRC20_DEPOSIT_ADDRESS = DEPOSIT_ADDR;
  vi.resetModules();
  // Deep-confirmed + successful, so nothing here is a finality decision.
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (String(url).includes('/walletsolidity/gettransactioninfobyid')) {
      return { ok: true, json: async () => ({ blockNumber: 1000, receipt: { result: 'SUCCESS' } }) } as any;
    }
    if (String(url).includes('/walletsolidity/getnowblock')) {
      return { ok: true, json: async () => ({ block_header: { raw_data: { number: 1100 } } }) } as any;
    }
    return { ok: false, json: async () => ({}) } as any;
  }));

  mockQueryOne.mockImplementation(async () => null); // no existing tx_hash
  mockQuery.mockImplementation(async (sql: string) => {
    if (String(sql).includes('expected_amount = $1')) return []; // no match: we only inspect the binding
    return [];
  });
  mockTransaction.mockImplementation(async (fn: (c: unknown) => Promise<unknown>) =>
    fn({ query: vi.fn().mockResolvedValue({ rows: [], rowCount: 1 }) }));
});

afterEach(() => {
  mockTransaction.mockReset();
  mockQuery.mockReset();
  mockQueryOne.mockReset();
  vi.unstubAllGlobals();
});

/**
 * Build an incoming transfer with an EXPLICIT base-unit string, so the fixture
 * itself never routes the amount through a float.
 */
function txWithRawValue(rawBaseUnits: string, hash = '0xhash-binding') {
  return {
    transaction_id: hash,
    to: DEPOSIT_ADDR,
    from: 'TSenderAddr',
    token_info: { decimals: 6, address: USDT_CONTRACT },
    value: rawBaseUnits,
    block_timestamp: Date.now(),
  };
}

/** The parameter array the monitor bound to the attribution query. */
function attributionParams(): unknown[] | undefined {
  const call = mockQuery.mock.calls.find(([sql]) => String(sql).includes('expected_amount = $1'));
  return call?.[1] as unknown[] | undefined;
}

describe('the monitor binds the attribution amount as an exact string', () => {
  it('binds a STRING, not a number', async () => {
    const { processIncomingTransaction } = await import('../tronDepositMonitor');
    await processIncomingTransaction(txWithRawValue('5123456'));

    const params = attributionParams();
    expect(params, 'attribution query must have run').toBeDefined();
    // Reverting to Number(...) makes this a 'number' and fails here.
    expect(typeof params![0]).toBe('string');
  });

  it('binds the exact decimal for a normal 6-decimal amount', async () => {
    const { processIncomingTransaction } = await import('../tronDepositMonitor');
    await processIncomingTransaction(txWithRawValue('5123456'));
    expect(attributionParams()![0]).toBe('5.123456');
  });

  it('preserves digits a double would destroy (2^53 + 1 base units)', async () => {
    // Number('9007199254740993') === 9007199254740992 — the last digit is lost,
    // and that digit is the attribution discriminator.
    const raw = '9007199254740993';
    expect(Number(raw).toString()).not.toBe(raw); // precondition

    const { processIncomingTransaction } = await import('../tronDepositMonitor');
    await processIncomingTransaction(txWithRawValue(raw));

    const bound = attributionParams()![0];
    expect(bound).toBe('9007199254.740993');
    // The legacy float path produced a different value entirely.
    expect(bound).not.toBe(String(Number(raw) / 1e6));
  });

  it('a ONE base-unit difference binds a different value (no collapsing)', async () => {
    const { processIncomingTransaction } = await import('../tronDepositMonitor');

    await processIncomingTransaction(txWithRawValue('9007199254740993', '0xa'));
    const first = attributionParams()![0];

    mockQuery.mockClear();
    await processIncomingTransaction(txWithRawValue('9007199254740994', '0xb'));
    const second = attributionParams()![0];

    expect(first).not.toBe(second);
  });

  it('binds a value that is NOT the float-derived one for a high-precision amount', async () => {
    const raw = '999999999999999999';
    const { processIncomingTransaction } = await import('../tronDepositMonitor');
    await processIncomingTransaction(txWithRawValue(raw));

    const bound = attributionParams()![0];
    expect(bound).toBe('999999999999.999999');
    expect(bound).not.toBe(Number(raw) / 1e6);
    expect(bound).not.toBe(String(Number(raw) / 1e6));
  });

  it('fails closed on a malformed amount: no attribution query at all', async () => {
    const { processIncomingTransaction } = await import('../tronDepositMonitor');
    await processIncomingTransaction(txWithRawValue('not-a-number'));
    expect(attributionParams()).toBeUndefined();
    expect(mockTransaction.mock.calls.length).toBe(0); // nothing credited
  });

  it('fails closed on a zero amount', async () => {
    const { processIncomingTransaction } = await import('../tronDepositMonitor');
    await processIncomingTransaction(txWithRawValue('0'));
    expect(attributionParams()).toBeUndefined();
    expect(mockTransaction.mock.calls.length).toBe(0);
  });

  it('uses no tolerance: the SQL is exact equality, not a range', async () => {
    const { processIncomingTransaction } = await import('../tronDepositMonitor');
    await processIncomingTransaction(txWithRawValue('5123456'));

    const sql = mockQuery.mock.calls
      .map(([s]) => String(s))
      .find((s) => s.includes('expected_amount = $1'))!;
    expect(sql).toContain('expected_amount = $1');
    expect(sql).not.toMatch(/BETWEEN|ABS\s*\(|<=|>=|~|epsilon/i);
  });
});
