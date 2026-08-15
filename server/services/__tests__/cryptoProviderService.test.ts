/**
 * @vitest-environment node
 *
 * Unit tests for isAutomatedCryptoPayoutConfigured — the predicate that gates
 * crypto withdrawals fail-closed. It must be network-aware: TronGrid dispatches
 * only TRC20, so any other network (which would fall to the stranding manual
 * path) must report "not automated".
 */
import { beforeEach, afterEach, vi, describe, it, expect } from 'vitest';

vi.mock('../../db/pool', () => ({ query: vi.fn(), queryOne: vi.fn(), transaction: vi.fn() }));
vi.mock('../../middleware/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const ENV_KEYS = ['CRYPTO_PROVIDER', 'TRON_HOT_WALLET_PRIVATE_KEY', 'BINANCE_API_KEY', 'BINANCE_SECRET_KEY', 'COINBASE_COMMERCE_API_KEY', 'CIRCLE_API_KEY'] as const;
const saved: Record<string, string | undefined> = {};

async function load(env: Record<string, string | undefined>) {
  for (const k of ENV_KEYS) delete process.env[k];
  for (const [k, v] of Object.entries(env)) if (v !== undefined) process.env[k] = v;
  vi.resetModules();
  return import('../cryptoProviderService');
}

beforeEach(() => { for (const k of ENV_KEYS) saved[k] = process.env[k]; });
afterEach(() => {
  for (const k of ENV_KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
});

describe('isAutomatedCryptoPayoutConfigured', () => {
  it('is false in manual mode for every network', async () => {
    const { isAutomatedCryptoPayoutConfigured } = await load({ CRYPTO_PROVIDER: 'manual' });
    for (const n of ['TRC20', 'ERC20', 'BEP20', 'POLYGON', undefined]) {
      expect(isAutomatedCryptoPayoutConfigured(n as string)).toBe(false);
    }
  });

  it('is false for trongrid without a hot-wallet key', async () => {
    const { isAutomatedCryptoPayoutConfigured } = await load({ CRYPTO_PROVIDER: 'trongrid' });
    expect(isAutomatedCryptoPayoutConfigured('TRC20')).toBe(false);
  });

  it('is TRUE for trongrid + key ONLY on TRC20', async () => {
    const { isAutomatedCryptoPayoutConfigured } = await load({ CRYPTO_PROVIDER: 'trongrid', TRON_HOT_WALLET_PRIVATE_KEY: 'k' });
    expect(isAutomatedCryptoPayoutConfigured('TRC20')).toBe(true);
    // Non-TRC20 networks route to the stranding manual path → not automated.
    for (const n of ['ERC20', 'BEP20', 'POLYGON', undefined]) {
      expect(isAutomatedCryptoPayoutConfigured(n as string)).toBe(false);
    }
  });

  it('defaults to false for an unknown provider', async () => {
    const { isAutomatedCryptoPayoutConfigured } = await load({ CRYPTO_PROVIDER: 'something_else' });
    expect(isAutomatedCryptoPayoutConfigured('TRC20')).toBe(false);
  });
});
