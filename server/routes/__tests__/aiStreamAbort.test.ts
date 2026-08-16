/**
 * @vitest-environment node
 *
 * Client-disconnect handling for the AI streaming route (CSO #5 follow-up).
 *
 * Before this, the route had no disconnect handling: a client could open a
 * request, drop the socket, and the `for await` loop kept draining the OpenAI
 * stream — billed to the platform key — writing into a dead response.
 *
 * Required behaviour on disconnect:
 *   - stop consuming the upstream stream promptly
 *   - abort the upstream request (AbortSignal / stream controller)
 *   - do NOT persist a truncated assistant reply as if it were complete
 *   - do NOT refund the reserved budget unit (see the policy test below)
 *   - remove listeners so they cannot leak per request
 *   - never write to a destroyed socket
 *
 * DETERMINISM: the fake upstream is gated, not timed. It yields one chunk, then
 * blocks on a promise the test releases only after it has *observed* the abort.
 * There are no sleeps and no chunk-count races, so `chunksConsumed` is an exact
 * value rather than a range.
 */
import express from 'express';
import { beforeEach, describe, it, expect, vi } from 'vitest';

const USER_ID = '11111111-1111-1111-1111-111111111111';
const CONVERSATION_ID = '22222222-2222-2222-2222-222222222222';

/** Chunks the fake upstream yields if never gated. */
const CHUNK_COUNT = 5;

let abortCalls = 0;
let chunksConsumed = 0;
let receivedSignal: AbortSignal | undefined;
const assistantInserts: string[] = [];
/** Any DELETE against ai_messages — i.e. a budget refund. Must stay empty. */
const messageDeletes: string[] = [];
/** Budget reservations actually persisted. */
let reservedInserts = 0;

/** Resolves once the fake upstream has yielded its first chunk. */
let firstChunk!: Promise<void>;
let markFirstChunk!: () => void;
/** The gate the fake upstream blocks on after chunk 0. */
let gate!: Promise<void>;
let openGate!: () => void;
/** Resolves when the fake upstream generator has fully unwound. */
let streamSettled!: Promise<void>;
let markStreamSettled!: () => void;

function resetSignals(gated: boolean) {
  firstChunk = new Promise<void>((r) => (markFirstChunk = r));
  streamSettled = new Promise<void>((r) => (markStreamSettled = r));
  if (gated) {
    gate = new Promise<void>((r) => (openGate = r));
  } else {
    gate = Promise.resolve();
    openGate = () => {};
  }
}
resetSignals(false);

/** Resolves as soon as the route's AbortSignal actually fires. */
function abortObserved(): Promise<void> {
  return new Promise((resolve) => {
    const check = () => {
      if (receivedSignal?.aborted) return resolve();
      if (receivedSignal) {
        receivedSignal.addEventListener('abort', () => resolve(), { once: true });
      } else {
        setImmediate(check);
      }
    };
    check();
  });
}

vi.mock('../../middleware/auth', async () => {
  const actual = await vi.importActual<typeof import('../../middleware/auth')>('../../middleware/auth');
  return {
    ...actual,
    authenticate: (req: any, _res: express.Response, next: express.NextFunction) => {
      req.user = { id: USER_ID, email: 'u@test.com', role: 'USER', sessionId: 's1' };
      next();
    },
  };
});

vi.mock('../../middleware/rateLimit', () => ({
  aiLimiter: (_req: any, _res: any, next: any) => next(),
  apiLimiter: (_req: any, _res: any, next: any) => next(),
  sensitiveOpLimiter: (_req: any, _res: any, next: any) => next(),
  financialOpLimiter: (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../db/pool', () => {
  const queryOne = vi.fn(async (sql: string) => {
    if (/FROM ai_conversations WHERE id/i.test(sql)) return { id: CONVERSATION_ID };
    if (/FROM users WHERE id/i.test(sql)) {
      return { full_name: 'Alice', kyc_status: 'pending', two_factor_enabled: false };
    }
    return null;
  });
  const query = vi.fn(async (sql: string, params: any[] = []) => {
    if (/DELETE\s+FROM\s+ai_messages/i.test(sql)) messageDeletes.push(sql);
    if (/INSERT INTO ai_messages/i.test(sql) && /'assistant'/.test(sql)) {
      assistantInserts.push(String(params[1]));
    }
    return [];
  });
  const transaction = vi.fn(async (cb: any) =>
    cb({
      query: async (sql: string) => {
        if (/COUNT\(\*\)/i.test(sql)) return { rows: [{ count: '0' }] };
        if (/INSERT INTO ai_messages/i.test(sql)) {
          reservedInserts++;
          return { rows: [{ id: 'm1' }], rowCount: 1 };
        }
        return { rows: [] };
      },
    }),
  );
  return { query, queryOne, transaction };
});

vi.mock('openai', () => ({
  default: class {
    chat = {
      completions: {
        create: async (_params: any, opts: any = {}) => {
          receivedSignal = opts?.signal;
          const controller = { abort: () => { abortCalls++; } };
          return {
            controller,
            async *[Symbol.asyncIterator]() {
              try {
                for (let i = 0; i < CHUNK_COUNT; i++) {
                  if (opts?.signal?.aborted) return;
                  chunksConsumed++;
                  yield { choices: [{ delta: { content: `c${i}` } }] };
                  if (i === 0) {
                    markFirstChunk();
                    // Block here until the test releases the gate. This is what
                    // makes the abort land at an exactly known point.
                    await gate;
                  }
                }
              } finally {
                markStreamSettled();
              }
            },
          };
        },
      },
    };
  },
}));

process.env.AI_INTEGRATIONS_OPENAI_API_KEY = 'test-key';

const { aiRouter } = await import('../ai');

function makeApp(onRequest?: (req: any, res: any) => void) {
  const app = express();
  app.use(express.json());
  if (onRequest) {
    app.use((req, res, next) => {
      onRequest(req, res);
      next();
    });
  }
  app.use('/api/ai', aiRouter);
  app.use((err: any, _req: any, res: any, _next: any) => {
    res.status(err.statusCode || 500).json({ error: { message: err.message, code: err.code } });
  });
  return app;
}

beforeEach(() => {
  abortCalls = 0;
  chunksConsumed = 0;
  receivedSignal = undefined;
  assistantInserts.length = 0;
  messageDeletes.length = 0;
  reservedInserts = 0;
});

/**
 * Drive a request, disconnect deterministically after the first streamed chunk,
 * and wait until the handler has fully unwound. No sleeps anywhere.
 */
async function disconnectMidStream(app: express.Express): Promise<void> {
  resetSignals(true);
  const server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  const { port } = server.address() as any;

  const http = await import('node:http');
  const req = http.request({
    port,
    path: `/api/ai/conversations/${CONVERSATION_ID}/messages`,
    method: 'POST',
    headers: { 'content-type': 'application/json' },
  });
  req.on('error', () => {});
  req.end(JSON.stringify({ content: 'hello' }));

  // 1. Wait until the upstream has actually produced a chunk.
  await firstChunk;
  // 2. Kill the socket.
  req.destroy();
  // 3. Wait until the route's AbortSignal has genuinely fired.
  await abortObserved();
  // 4. Release the gate so the generator can observe the abort and unwind.
  openGate();
  // 5. Wait for the generator to finish.
  await streamSettled;

  await new Promise((r) => server.close(r as any));
}

describe('client disconnect aborts the paid stream', () => {
  it('stops consuming the upstream after exactly one chunk', async () => {
    await disconnectMidStream(makeApp());
    // Exact, not a range: the gate guarantees where the stream stopped.
    expect(chunksConsumed).toBe(1);
  });

  it('aborts the upstream request', async () => {
    await disconnectMidStream(makeApp());
    expect(abortCalls).toBeGreaterThan(0);
  });

  it('passes an AbortSignal to the OpenAI client and fires it', async () => {
    await disconnectMidStream(makeApp());
    expect(receivedSignal).toBeDefined();
    expect(receivedSignal?.aborted).toBe(true);
  });

  it('does NOT persist a fabricated assistant completion after abort', async () => {
    await disconnectMidStream(makeApp());
    expect(assistantInserts).toHaveLength(0);
  });
});

describe('budget-on-abort policy is deliberate and pinned', () => {
  it('keeps the reserved budget unit consumed after a disconnect', async () => {
    // POLICY: the reservation is NOT refunded. Refunding on disconnect would let
    // a client stream-and-drop indefinitely for free upstream tokens, which is
    // the unmetered-spend hole the budget exists to close. This test exists so a
    // well-meaning "refund on abort" change cannot land silently.
    await disconnectMidStream(makeApp());

    expect(reservedInserts).toBe(1);
    expect(messageDeletes).toHaveLength(0);
    // And nothing was delivered in exchange for it.
    expect(assistantInserts).toHaveLength(0);
  });
});

describe('a completed stream is unaffected', () => {
  it('persists exactly one assistant row and never aborts', async () => {
    resetSignals(false);
    const server = makeApp().listen(0);
    await new Promise((r) => server.once('listening', r));
    const { port } = server.address() as any;

    const res = await fetch(
      `http://127.0.0.1:${port}/api/ai/conversations/${CONVERSATION_ID}/messages`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ content: 'hello' }),
      },
    );
    await res.text();
    await streamSettled;

    expect(abortCalls).toBe(0);
    expect(assistantInserts).toHaveLength(1);
    expect(chunksConsumed).toBe(CHUNK_COUNT);
    await new Promise((r) => server.close(r as any));
  });

  it('leaves no close/error listener behind', async () => {
    resetSignals(false);
    let captured: { req: any; res: any } | null = null;
    const server = makeApp((req, res) => {
      captured = { req, res };
    }).listen(0);
    await new Promise((r) => server.once('listening', r));
    const { port } = server.address() as any;

    const res = await fetch(
      `http://127.0.0.1:${port}/api/ai/conversations/${CONVERSATION_ID}/messages`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ content: 'hello' }),
      },
    );
    await res.text();
    await streamSettled;

    const c = captured as unknown as { req: any; res: any };
    expect(c).not.toBeNull();
    // The disconnect listener must be detached — that is the one that would
    // accumulate and keep the AbortController alive.
    expect(c.req.listenerCount('close')).toBe(0);
    expect(c.res.listenerCount('close')).toBe(0);

    // The 'error' listener is intentionally NOT detached. Socket errors
    // (ECONNRESET / ERR_STREAM_DESTROYED) are emitted on a LATER tick than
    // res.end(), so removing it synchronously in `finally` would leave exactly
    // those errors unhandled and crash the process. Exactly one is attached per
    // response, and the response is released with the request.
    expect(c.res.listenerCount('error')).toBe(1);

    await new Promise((r) => server.close(r as any));
  });
});
