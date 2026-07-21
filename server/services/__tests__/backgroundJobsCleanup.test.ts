/**
 * @vitest-environment node
 *
 * Regression tests for the optional email_verification_tokens cleanup in
 * cleanupExpiredData().
 *
 * Background: on startup the cleanup job used to run an unconditional
 * DELETE FROM email_verification_tokens wrapped in a bare `catch {}`. In
 * environments without that optional table, the DELETE raised an error that
 * the query wrapper logged (a spurious startup warning) before the bare catch
 * swallowed it. The bare catch also hid genuinely unrelated DELETE failures.
 *
 * The fix probes for the table with to_regclass('public.email_verification_tokens')
 * first and only issues the DELETE when the relation exists. These tests lock in:
 *   1. table present  -> DELETE runs
 *   2. table absent    -> DELETE is skipped (no error, no warning)
 *   3. a real DELETE failure is NOT suppressed by a local catch
 */
import { afterEach, vi, describe, it, expect } from 'vitest';

const mockQuery = vi.fn();
const mockQueryOne = vi.fn();
const mockLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };

vi.mock('../../db/pool', () => ({
  pool: { connect: vi.fn() },
  query: (...args: unknown[]) => mockQuery(...args),
  queryOne: (...args: unknown[]) => mockQueryOne(...args),
}));
vi.mock('../../middleware/logger', () => ({ logger: mockLogger }));

// node-cron and the deposit monitor are imported by the module under test but
// unused by cleanupExpiredData; stub them so importing the module is side-effect free.
vi.mock('node-cron', () => ({ default: { schedule: vi.fn() } }));
vi.mock('../tronDepositMonitor', () => ({ checkForNewDeposits: vi.fn() }));

afterEach(() => {
  mockQuery.mockReset();
  mockQueryOne.mockReset();
  mockLogger.info.mockReset();
  mockLogger.warn.mockReset();
  mockLogger.error.mockReset();
  mockLogger.debug.mockReset();
});

/** Default: every non-probe query resolves to an empty result set. */
function stubQueriesOk() {
  mockQuery.mockResolvedValue([]);
}

const emailDeleteCalls = () =>
  mockQuery.mock.calls.filter(([sql]) =>
    typeof sql === 'string' && sql.includes('DELETE FROM email_verification_tokens'));

const probeCalls = () =>
  mockQueryOne.mock.calls.filter(([sql]) =>
    typeof sql === 'string' && sql.includes("to_regclass('public.email_verification_tokens')"));

describe('cleanupExpiredData email_verification_tokens handling', () => {
  it('probes with to_regclass and runs the DELETE when the table exists', async () => {
    stubQueriesOk();
    mockQueryOne.mockResolvedValue({ regclass: 'email_verification_tokens' });

    const { cleanupExpiredData } = await import('../backgroundJobs');
    await cleanupExpiredData();

    expect(probeCalls()).toHaveLength(1);
    expect(emailDeleteCalls()).toHaveLength(1);
    expect(emailDeleteCalls()[0][0]).toContain('verified_at IS NULL');
    // No error path taken.
    expect(mockLogger.error).not.toHaveBeenCalled();
  });

  it('skips the DELETE (no error, no warning) when the table is absent', async () => {
    stubQueriesOk();
    // to_regclass returns NULL for a missing relation.
    mockQueryOne.mockResolvedValue({ regclass: null });

    const { cleanupExpiredData } = await import('../backgroundJobs');
    await cleanupExpiredData();

    expect(probeCalls()).toHaveLength(1);
    // The DELETE must never be issued when the table is missing.
    expect(emailDeleteCalls()).toHaveLength(0);
    // Absence is benign: no error and no warning are emitted.
    expect(mockLogger.error).not.toHaveBeenCalled();
    expect(mockLogger.warn).not.toHaveBeenCalled();
  });

  it('does not suppress an unrelated DELETE failure with a local catch', async () => {
    // Table exists, but the DELETE fails for an unrelated reason (e.g. a
    // permission error). The old bare `catch {}` would have hidden this; the
    // fix must let it surface to the outer cleanup handler, which logs it.
    const permissionError = Object.assign(new Error('permission denied for table email_verification_tokens'), {
      code: '42501',
    });
    mockQueryOne.mockResolvedValue({ regclass: 'email_verification_tokens' });
    mockQuery.mockImplementation(async (sql: string) => {
      if (typeof sql === 'string' && sql.includes('DELETE FROM email_verification_tokens')) {
        throw permissionError;
      }
      return [];
    });

    const { cleanupExpiredData } = await import('../backgroundJobs');
    // cleanupExpiredData catches at the top level so the cron job stays alive,
    // but the error must be reported, not silently ignored.
    await cleanupExpiredData();

    expect(emailDeleteCalls()).toHaveLength(1);
    expect(mockLogger.error).toHaveBeenCalledWith(
      '[Cleanup] Error during database cleanup:',
      permissionError,
    );
  });
});
