/**
 * @vitest-environment node
 *
 * FIN-6 — the risk/fraud layer must FAIL CLOSED.
 *
 * A risk engine that cannot run has NOT cleared the transaction. If a DB error,
 * malformed response, or unavailable dependency silently produced
 * `allowed:true` / `passed:true`, every financial operation would sail through
 * unscreened for the duration of the outage — precisely when abuse is easiest.
 */
import { beforeEach, afterEach, vi, describe, it, expect } from 'vitest';

const mockQuery = vi.fn();
const mockQueryOne = vi.fn();

vi.mock('../../db/pool', () => ({
  query: (...a: unknown[]) => mockQuery(...a),
  queryOne: (...a: unknown[]) => mockQueryOne(...a),
}));
vi.mock('../../middleware/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('../notificationService', () => ({ createNotification: vi.fn() }));

beforeEach(() => {
  vi.resetModules();
  mockQuery.mockReset();
  mockQueryOne.mockReset();
});
afterEach(() => vi.restoreAllMocks());

describe('checkLoginVelocity fails closed', () => {
  it('DB error -> allowed:false (does not silently permit the login)', async () => {
    mockQueryOne.mockRejectedValue(new Error('connection terminated'));
    const { checkLoginVelocity } = await import('../fraudService');

    const res = await checkLoginVelocity('user@example.com', '203.0.113.9');
    expect(res.allowed).toBe(false);
    expect(res.reason).toMatch(/temporarily unavailable/i);
  });

  it('still allows a clean check when the DB is healthy', async () => {
    mockQueryOne.mockResolvedValue({ count: '0' });
    const { checkLoginVelocity } = await import('../fraudService');

    expect((await checkLoginVelocity('user@example.com')).allowed).toBe(true);
  });

  it('blocks on genuine velocity breach (unchanged behaviour)', async () => {
    mockQueryOne.mockResolvedValue({ count: '25' });
    const { checkLoginVelocity } = await import('../fraudService');

    expect((await checkLoginVelocity('user@example.com')).allowed).toBe(false);
  });
});

describe('runFraudChecks fails closed', () => {
  it('DB error -> passed:false with FRAUD_CHECK_ERROR and max risk score', async () => {
    mockQueryOne.mockRejectedValue(new Error('DB down'));
    mockQuery.mockRejectedValue(new Error('DB down'));
    const { runFraudChecks } = await import('../fraudService');

    const res = await runFraudChecks({ userId: 'user-1', action: 'P2P_TRANSFER', amount: 500_00 });
    expect(res.passed).toBe(false);
    expect(res.flags).toContain('FRAUD_CHECK_ERROR');
    expect(res.score).toBe(100);
  });

  it('a malformed/throwing device lookup also fails closed', async () => {
    mockQueryOne.mockResolvedValue({ count: '0' });
    mockQuery.mockImplementation(async () => { throw new Error('relation "user_devices" does not exist'); });
    const { runFraudChecks } = await import('../fraudService');

    const res = await runFraudChecks({ userId: 'user-1', action: 'WITHDRAWAL', amount: 100_00, ipAddress: '203.0.113.9' });
    expect(res.passed).toBe(false);
  });

  it('passes a clean, low-risk transaction when the engine is healthy', async () => {
    mockQueryOne.mockResolvedValue({ count: '0', total: '0', created_at: new Date(Date.now() - 365 * 864e5).toISOString(), kyc_status: 'approved', email_verified: true });
    mockQuery.mockResolvedValue([]);
    const { runFraudChecks } = await import('../fraudService');

    const res = await runFraudChecks({ userId: 'user-1', action: 'P2P_TRANSFER', amount: 100 });
    expect(res.passed).toBe(true);
  });
});
