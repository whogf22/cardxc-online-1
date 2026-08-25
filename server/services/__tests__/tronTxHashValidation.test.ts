/**
 * @vitest-environment node
 *
 * LOW — TRON transaction-hash validation before building the provider URL.
 *
 * getTransactionByHash interpolated the caller-supplied hash straight into a
 * TronGrid URL: `${TRONGRID_BASE}/v1/transactions/${txHash}/info`. A value
 * containing '/', '?', '#', or '..' would change which endpoint was called
 * (request-target injection). A TRON tx id is exactly 64 hex chars, so the
 * value is now validated (and encoded) before any fetch.
 */
import { afterEach, beforeEach, vi, describe, it, expect } from 'vitest';

vi.mock('../../db/pool', () => ({ query: vi.fn(), queryOne: vi.fn(), transaction: vi.fn() }));
vi.mock('../../middleware/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock('../../lib/tokenAmount', () => ({ baseUnitsToExactDecimal: vi.fn() }));

import { isValidTronTxHash, getTransactionByHash } from '../tronDepositMonitor';

const VALID = 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789'; // 64 hex

let mockFetch: ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockFetch = vi.fn(async () => ({ ok: true, json: async () => ({ txID: VALID, ok: true }) }));
  vi.stubGlobal('fetch', mockFetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('isValidTronTxHash', () => {
  it.each([
    [VALID],
    ['A'.repeat(64)],
    ['0'.repeat(64)],
    ['abcDEF0123456789'.repeat(4)], // mixed case, 64 chars
  ])('accepts a 64-char hex id: %s', (h) => {
    expect(isValidTronTxHash(h)).toBe(true);
  });

  it.each([
    ['too short', 'abc'],
    ['63 chars', 'a'.repeat(63)],
    ['65 chars', 'a'.repeat(65)],
    ['0x prefixed', '0x' + 'a'.repeat(64)],
    ['non-hex g', 'g'.repeat(64)],
    ['path traversal', '../../accounts/TEvil0000000000000000000000000000000'],
    ['embedded slash', 'a'.repeat(32) + '/' + 'a'.repeat(31)],
    ['query smuggle', 'a'.repeat(60) + '?x=1'],
    ['empty', ''],
    ['whitespace', ' '.repeat(64)],
  ])('rejects %s', (_label, h) => {
    expect(isValidTronTxHash(h)).toBe(false);
  });

  it.each([[null], [undefined], [12345], [{}]])('rejects non-string %s', (h) => {
    expect(isValidTronTxHash(h as unknown)).toBe(false);
  });
});

describe('getTransactionByHash', () => {
  it('fetches the exact /info endpoint for a valid hash and returns the payload', async () => {
    const res = await getTransactionByHash(VALID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(
      `https://api.trongrid.io/v1/transactions/${VALID}/info`,
      expect.anything(),
    );
    expect(res).toEqual({ txID: VALID, ok: true });
  });

  it.each([
    ['../../accounts/TEvil'],
    ['a'.repeat(32) + '/' + 'a'.repeat(31)],
    ['a'.repeat(60) + '?x=1'],
    ['not-a-hash'],
    [''],
  ])('returns null WITHOUT fetching for a malformed hash: %s', async (bad) => {
    const res = await getTransactionByHash(bad);
    expect(res).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
