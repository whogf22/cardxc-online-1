/**
 * @vitest-environment node
 *
 * Concurrency regression for the AI daily budget (CSO #5 follow-up).
 *
 * The previous shape was a read-then-act TOCTOU: `assertDailyAiBudget` ran a
 * COUNT, returned, and the route then INSERTed the message in a separate
 * statement. N concurrent requests all observed the same pre-insert count and
 * all passed, so the ceiling could be overrun by up to the burst-limiter width.
 *
 * `reserveDailyAiMessage` now does lock -> count -> insert inside ONE
 * transaction, taking a per-user advisory lock that is held to COMMIT. These
 * tests model that serialisation and assert the ceiling holds exactly.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * A fake pg client backed by an in-memory row store, with a real per-user
 * advisory-lock queue. `transaction()` below hands each caller its own client
 * but they share `state`, so genuinely interleaved execution is possible —
 * which is exactly what the old code failed on.
 */
type State = {
  rows: Array<{ userId: string; role: string }>;
  locks: Map<string, Promise<void>>;
  lockWaits: number;
  inserts: number;
};

let state: State;

function makeClient(limitRow: () => string) {
  let releaseLock: (() => void) | null = null;

  return {
    query: async (sql: string, params: any[] = []) => {
      if (/pg_advisory_xact_lock/i.test(sql)) {
        const key = String(params[0]);

        // A real advisory lock is a queue, not a broadcast. The tail must be
        // published SYNCHRONOUSLY, before awaiting the predecessor, so callers
        // arriving in the same tick chain behind each other instead of all
        // waking on one shared promise.
        // Capture contention BEFORE publishing the new tail — checking after
        // the set() would always be true and make the assertion vacuous.
        const hadPredecessor = state.locks.has(key);
        if (hadPredecessor) state.lockWaits++;

        let release!: () => void;
        const mine = new Promise<void>((r) => (release = r));
        const prev = state.locks.get(key) ?? Promise.resolve();
        state.locks.set(
          key,
          prev.then(() => mine),
        );

        await prev;

        releaseLock = () => release();
        return { rows: [] };
      }

      if (/COUNT\(\*\)/i.test(sql)) {
        return { rows: [{ count: limitRow() }] };
      }

      if (/INSERT INTO ai_messages/i.test(sql)) {
        state.inserts++;
        state.rows.push({ userId: String(params[0] ?? 'u'), role: 'user' });
        return { rows: [{ id: 'msg-' + state.inserts }], rowCount: 1 };
      }

      return { rows: [] };
    },
    __release: () => releaseLock?.(),
  };
}

const transactionMock = vi.fn(async (cb: any) => {
  const client = makeClient(() =>
    String(state.rows.filter((r) => r.role === 'user').length),
  );
  try {
    return await cb(client);
  } finally {
    // Advisory xact locks release at COMMIT/ROLLBACK.
    client.__release();
  }
});

vi.mock('../../db/pool', () => ({
  queryOne: vi.fn(),
  query: vi.fn(),
  transaction: (cb: any) => transactionMock(cb),
}));

vi.mock('../../middleware/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

const USER = '11111111-1111-1111-1111-111111111111';
const CONV = '22222222-2222-2222-2222-222222222222';

beforeEach(() => {
  state = { rows: [], locks: new Map(), lockWaits: 0, inserts: 0 };
  transactionMock.mockClear();
  vi.unstubAllEnvs();
});

async function loadService() {
  vi.resetModules();
  return import('../aiUsageService');
}

describe('reserveDailyAiMessage — concurrent requests cannot overrun the ceiling', () => {
  it('serialises 20 simultaneous requests against a limit of 5', async () => {
    vi.stubEnv('AI_DAILY_MESSAGE_LIMIT', '5');
    const { reserveDailyAiMessage } = await loadService();

    const results = await Promise.allSettled(
      Array.from({ length: 20 }, () => reserveDailyAiMessage(USER, CONV, 'hi')),
    );

    const ok = results.filter((r) => r.status === 'fulfilled').length;
    const refused = results.filter(
      (r) => r.status === 'rejected' && (r.reason as any).code === 'AI_DAILY_LIMIT',
    ).length;

    expect(ok).toBe(5);
    expect(refused).toBe(15);
    // Exactly the accepted requests wrote a row — no overrun.
    expect(state.inserts).toBe(5);
  });

  it('actually contends on the advisory lock (the test would be vacuous otherwise)', async () => {
    vi.stubEnv('AI_DAILY_MESSAGE_LIMIT', '3');
    const { reserveDailyAiMessage } = await loadService();

    await Promise.allSettled(
      Array.from({ length: 10 }, () => reserveDailyAiMessage(USER, CONV, 'hi')),
    );

    // 10 concurrent callers => 9 of them must genuinely queue behind a predecessor.
    expect(state.lockWaits).toBe(9);
  });

  it('takes the lock BEFORE counting', async () => {
    vi.stubEnv('AI_DAILY_MESSAGE_LIMIT', '5');
    const { reserveDailyAiMessage } = await loadService();

    const order: string[] = [];
    transactionMock.mockImplementationOnce(async (cb: any) => {
      const client = {
        query: async (sql: string) => {
          if (/pg_advisory_xact_lock/i.test(sql)) order.push('lock');
          else if (/COUNT\(\*\)/i.test(sql)) {
            order.push('count');
            return { rows: [{ count: '0' }] };
          } else if (/INSERT INTO ai_messages/i.test(sql)) order.push('insert');
          return { rows: [{ id: 'x' }], rowCount: 1 };
        },
      };
      return cb(client);
    });

    await reserveDailyAiMessage(USER, CONV, 'hi');
    expect(order).toEqual(['lock', 'count', 'insert']);
  });

  it('locks per user, so two different users do not block each other', async () => {
    vi.stubEnv('AI_DAILY_MESSAGE_LIMIT', '100');
    const { reserveDailyAiMessage } = await loadService();

    const keys: string[] = [];
    transactionMock.mockImplementation(async (cb: any) => {
      const client = {
        query: async (sql: string, params: any[] = []) => {
          if (/pg_advisory_xact_lock/i.test(sql)) keys.push(String(params[0]));
          if (/COUNT\(\*\)/i.test(sql)) return { rows: [{ count: '0' }] };
          return { rows: [{ id: 'x' }], rowCount: 1 };
        },
      };
      return cb(client);
    });

    await reserveDailyAiMessage(USER, CONV, 'hi');
    await reserveDailyAiMessage('99999999-9999-9999-9999-999999999999', CONV, 'hi');

    expect(keys).toHaveLength(2);
    expect(keys[0]).not.toBe(keys[1]);
    // Pin the key to the userId itself, not merely "two users differ".
    expect(keys[0]).toBe(USER);
    expect(keys[1]).toBe('99999999-9999-9999-9999-999999999999');
  });
});

describe('reserveDailyAiMessage — limit 0 disables the assistant', () => {
  it('refuses the very first request when the limit is 0', async () => {
    vi.stubEnv('AI_DAILY_MESSAGE_LIMIT', '0');
    const { reserveDailyAiMessage, getAiDailyMessageLimit } = await loadService();

    expect(getAiDailyMessageLimit()).toBe(0);
    await expect(reserveDailyAiMessage(USER, CONV, 'hi')).rejects.toMatchObject({
      statusCode: 429,
      code: 'AI_DAILY_LIMIT',
    });
    expect(state.inserts).toBe(0);
  });
});

describe('reserveDailyAiMessage — fails closed', () => {
  it('refuses and does not insert when the transaction throws', async () => {
    const { reserveDailyAiMessage } = await loadService();
    transactionMock.mockRejectedValueOnce(new Error('connection terminated'));

    await expect(reserveDailyAiMessage(USER, CONV, 'hi')).rejects.toMatchObject({
      statusCode: 503,
      code: 'AI_BUDGET_UNAVAILABLE',
    });
  });

  it('does not leak the underlying database error', async () => {
    const { reserveDailyAiMessage } = await loadService();
    transactionMock.mockRejectedValueOnce(
      new Error('password authentication failed for user "postgres"'),
    );
    await expect(reserveDailyAiMessage(USER, CONV, 'hi')).rejects.not.toThrow(/postgres/);
  });

  it('propagates the 429 rather than masking it as a 503', async () => {
    vi.stubEnv('AI_DAILY_MESSAGE_LIMIT', '0');
    const { reserveDailyAiMessage } = await loadService();
    await expect(reserveDailyAiMessage(USER, CONV, 'hi')).rejects.toMatchObject({
      code: 'AI_DAILY_LIMIT',
    });
  });

  it('refuses a non-numeric count', async () => {
    const { reserveDailyAiMessage } = await loadService();
    transactionMock.mockImplementationOnce(async (cb: any) =>
      cb({
        query: async (sql: string) => {
          if (/COUNT\(\*\)/i.test(sql)) return { rows: [{ count: 'not-a-number' }] };
          return { rows: [] };
        },
      }),
    );
    await expect(reserveDailyAiMessage(USER, CONV, 'hi')).rejects.toMatchObject({
      code: 'AI_BUDGET_UNAVAILABLE',
    });
  });

  it('rejects a missing user id without touching the database', async () => {
    const { reserveDailyAiMessage } = await loadService();
    await expect(reserveDailyAiMessage('', CONV, 'hi')).rejects.toThrow();
    expect(transactionMock).not.toHaveBeenCalled();
  });
});
