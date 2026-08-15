/**
 * @vitest-environment node
 *
 * Regression: Socket.IO handshake auth must revalidate the DB session, so a
 * revoked/expired/signed-out session cannot open a socket even with a still-valid
 * JWT signature.
 */
import { beforeEach, afterEach, vi, describe, it, expect } from 'vitest';
import jwt from 'jsonwebtoken';

const mockPoolQuery = vi.fn();
const SECRET = 'y'.repeat(48);

vi.mock('../../db/pool', () => ({
  pool: { query: (...a: unknown[]) => mockPoolQuery(...a) },
}));
vi.mock('../../lib/jwtSecret', () => ({ getJwtSecret: () => SECRET }));
vi.mock('../../middleware/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

function sign(payload: object) {
  return jwt.sign(payload, SECRET, { algorithm: 'HS256', expiresIn: '1h' });
}

beforeEach(() => {
  mockPoolQuery.mockReset();
});
afterEach(() => vi.resetModules());

describe('authenticateSocketToken', () => {
  it('rejects when no token is provided', async () => {
    const { authenticateSocketToken } = await import('../socketService');
    expect(await authenticateSocketToken(undefined)).toBeNull();
  });

  it('rejects a token with a valid signature but no active session (revoked)', async () => {
    mockPoolQuery.mockResolvedValueOnce({ rows: [] }); // session not found / inactive
    const { authenticateSocketToken } = await import('../socketService');
    const token = sign({ userId: 'user-1', sessionId: 'sess-1' });
    expect(await authenticateSocketToken(token)).toBeNull();
  });

  it('rejects when the session belongs to a different user', async () => {
    mockPoolQuery.mockResolvedValueOnce({ rows: [{ user_id: 'someone-else', role: 'USER', account_status: 'active' }] });
    const { authenticateSocketToken } = await import('../socketService');
    const token = sign({ userId: 'user-1', sessionId: 'sess-1' });
    expect(await authenticateSocketToken(token)).toBeNull();
  });

  it('rejects when the account is not active', async () => {
    mockPoolQuery.mockResolvedValueOnce({ rows: [{ user_id: 'user-1', role: 'USER', account_status: 'suspended' }] });
    const { authenticateSocketToken } = await import('../socketService');
    const token = sign({ userId: 'user-1', sessionId: 'sess-1' });
    expect(await authenticateSocketToken(token)).toBeNull();
  });

  it('accepts a valid, active session owned by the token user', async () => {
    mockPoolQuery.mockResolvedValueOnce({ rows: [{ user_id: 'user-1', role: 'USER', account_status: 'active' }] });
    const { authenticateSocketToken } = await import('../socketService');
    const token = sign({ userId: 'user-1', sessionId: 'sess-1' });
    expect(await authenticateSocketToken(token)).toEqual({ userId: 'user-1', role: 'USER' });
  });

  it('rejects a token signed with the wrong key', async () => {
    const { authenticateSocketToken } = await import('../socketService');
    const bad = jwt.sign({ userId: 'user-1', sessionId: 'sess-1' }, 'wrong-secret-wrong-secret-wrong-secret', { algorithm: 'HS256' });
    expect(await authenticateSocketToken(bad)).toBeNull();
    expect(mockPoolQuery).not.toHaveBeenCalled();
  });
});

/**
 * Live-connection revalidation: a socket must re-check the DB session before
 * protected actions, so a logout/revocation/role-change takes effect on an
 * already-open socket (not just at handshake).
 */
function fakeSocket(token: string, userId = 'user-1') {
  return {
    data: { token },
    userId,
    userRole: 'USER',
    emitted: [] as Array<{ event: string; payload?: unknown }>,
    disconnected: false,
    emit(event: string, payload?: unknown) { this.emitted.push({ event, payload }); },
    disconnect() { this.disconnected = true; },
  };
}

describe('revalidateSocketSession (live connection)', () => {
  it('allows an action while the session is still valid (no disconnect)', async () => {
    mockPoolQuery.mockResolvedValueOnce({ rows: [{ user_id: 'user-1', role: 'USER', account_status: 'active' }] });
    const { revalidateSocketSession } = await import('../socketService');
    const s = fakeSocket(sign({ userId: 'user-1', sessionId: 'sess-1' }));
    const res = await revalidateSocketSession(s);
    expect(res).toEqual({ userId: 'user-1', role: 'USER' });
    expect(s.disconnected).toBe(false);
  });

  it('denies + disconnects after the session is revoked/logged out', async () => {
    mockPoolQuery.mockResolvedValueOnce({ rows: [] }); // session no longer active
    const { revalidateSocketSession } = await import('../socketService');
    const s = fakeSocket(sign({ userId: 'user-1', sessionId: 'sess-1' }));
    const res = await revalidateSocketSession(s);
    expect(res).toBeNull();
    expect(s.disconnected).toBe(true);
    expect(s.emitted.some(e => e.event === 'auth:revoked')).toBe(true);
  });

  it('denies + disconnects when the session now belongs to another user', async () => {
    mockPoolQuery.mockResolvedValueOnce({ rows: [{ user_id: 'someone-else', role: 'USER', account_status: 'active' }] });
    const { revalidateSocketSession } = await import('../socketService');
    const s = fakeSocket(sign({ userId: 'user-1', sessionId: 'sess-1' }));
    expect(await revalidateSocketSession(s)).toBeNull();
    expect(s.disconnected).toBe(true);
  });

  it('refreshes role so a downgraded admin loses admin authorization', async () => {
    mockPoolQuery.mockResolvedValueOnce({ rows: [{ user_id: 'user-1', role: 'USER', account_status: 'active' }] });
    const { revalidateSocketSession } = await import('../socketService');
    const s = fakeSocket(sign({ userId: 'user-1', sessionId: 'sess-1' }));
    s.userRole = 'SUPER_ADMIN'; // was admin at connect
    const res = await revalidateSocketSession(s);
    expect(res?.role).toBe('USER'); // refreshed to current role
    expect(s.userRole).toBe('USER');
  });

  it('reflects a currently-active admin as SUPER_ADMIN', async () => {
    mockPoolQuery.mockResolvedValueOnce({ rows: [{ user_id: 'user-1', role: 'SUPER_ADMIN', account_status: 'active' }] });
    const { revalidateSocketSession } = await import('../socketService');
    const s = fakeSocket(sign({ userId: 'user-1', sessionId: 'sess-1' }));
    const res = await revalidateSocketSession(s);
    expect(res?.role).toBe('SUPER_ADMIN');
    expect(s.disconnected).toBe(false);
  });
});
