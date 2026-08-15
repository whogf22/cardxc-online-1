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
