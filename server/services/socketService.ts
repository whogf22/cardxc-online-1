import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import { logger } from '../middleware/logger';
import { pool } from '../db/pool';
import jwt from 'jsonwebtoken';
import { getJwtSecret } from '../lib/jwtSecret';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  userRole?: string;
}

let io: SocketIOServer | null = null;

/** Room receiving privileged, server-pushed admin broadcasts. */
const ADMIN_ROOM = 'admin';
/** How often idle admin sockets are re-authorized (NEW-1). */
const ADMIN_SWEEP_INTERVAL_MS = 30_000;
let adminSweepTimer: NodeJS.Timeout | null = null;

// Track online users: userId -> Set of socketIds
const onlineUsers = new Map<string, Set<string>>();

/**
 * Authenticate a Socket.IO handshake token. Mirrors the HTTP `authenticate`
 * middleware: verifies the JWT (HS256) and then revalidates the DB `sessions`
 * row (active, unexpired, owned by the token's user, account active). Returns
 * null on any failure so a signed-out/revoked session cannot open or keep a
 * live socket until the JWT would otherwise expire. Exported for testing.
 */
export async function authenticateSocketToken(
  token: string | undefined,
): Promise<{ userId: string; role: string } | null> {
  if (!token) return null;

  let decoded: { userId?: string; sessionId?: string };
  try {
    // getJwtSecret() throws if SESSION_SECRET/JWT_SECRET is missing/too short,
    // so we never accept a socket with an invalid signing key.
    decoded = jwt.verify(token, getJwtSecret(), { algorithms: ['HS256'] }) as { userId?: string; sessionId?: string };
  } catch {
    return null;
  }

  if (!decoded.userId || !decoded.sessionId) return null;

  const result = await pool.query(
    `SELECT s.user_id, u.role, u.account_status
     FROM sessions s
     JOIN users u ON s.user_id = u.id
     WHERE s.id = $1 AND s.is_active = TRUE AND s.expires_at > NOW()`,
    [decoded.sessionId],
  );

  const row = result.rows[0];
  if (!row || row.user_id !== decoded.userId || row.account_status !== 'active') {
    return null;
  }

  return { userId: row.user_id, role: row.role };
}

/** Minimal socket surface needed to revalidate + revoke a live connection. */
interface RevalidatableSocket {
  data?: { token?: string };
  userId?: string;
  userRole?: string;
  emit: (event: string, payload?: unknown) => void;
  disconnect: (close?: boolean) => void;
  leave?: (room: string) => void;
}

/**
 * Revalidate the DB session for an ALREADY-CONNECTED socket before servicing a
 * protected event. Handshake-time validation is not enough: a session can be
 * revoked (logout), expire, or the account be deactivated while the socket
 * stays open. On failure this notifies the client and force-disconnects the
 * socket, returning null; on success it refreshes the socket's role (so a
 * privilege change takes effect immediately) and returns the fresh identity.
 * Exported for testing.
 */
export async function revalidateSocketSession(
  socket: RevalidatableSocket,
): Promise<{ userId: string; role: string } | null> {
  const auth = await authenticateSocketToken(socket.data?.token);
  if (!auth || auth.userId !== socket.userId) {
    // Revoked/expired/deactivated: drop the admin room membership FIRST so no
    // in-flight broadcast can still reach this socket, then disconnect.
    socket.leave?.(ADMIN_ROOM);
    socket.emit('auth:revoked', { message: 'Session is no longer valid. Please sign in again.' });
    socket.disconnect(true);
    return null;
  }
  socket.userRole = auth.role;
  // A live downgrade (SUPER_ADMIN -> USER) must immediately stop server-PUSHED
  // admin broadcasts, not just gate the pull handlers.
  if (auth.role !== 'SUPER_ADMIN') {
    socket.leave?.(ADMIN_ROOM);
  }
  return auth;
}

/**
 * Re-authorize every socket currently in the admin room and evict any that is no
 * longer an active SUPER_ADMIN.
 *
 * Event-time revalidation only covers sockets that emit something. A demoted or
 * logged-out admin whose client sits idle would otherwise keep receiving pushed
 * `admin:*` broadcasts (other users' transactions, withdrawals, alerts, platform
 * aggregates) until it happened to send an event or disconnect. This sweep is
 * what makes revocation take effect without a reconnect. Exported for testing.
 */
export async function sweepAdminRoom(server: {
  in: (room: string) => { fetchSockets: () => Promise<any[]> };
}): Promise<number> {
  let evicted = 0;
  try {
    const sockets = await server.in(ADMIN_ROOM).fetchSockets();
    for (const s of sockets) {
      try {
        const auth = await authenticateSocketToken(s.data?.token);
        if (!auth || auth.userId !== s.userId || auth.role !== 'SUPER_ADMIN') {
          s.leave(ADMIN_ROOM);
          evicted += 1;
          if (!auth || auth.userId !== s.userId) {
            // Session fully revoked — tear the connection down too.
            s.emit('auth:revoked', { message: 'Session is no longer valid. Please sign in again.' });
            s.disconnect(true);
          }
          logger.info('[Socket] Evicted socket from admin room', { userId: s.userId, reason: auth ? 'role_downgraded' : 'session_revoked' });
        }
      } catch (err) {
        logger.error('[Socket] admin room sweep error for socket', err);
      }
    }
  } catch (err) {
    logger.error('[Socket] admin room sweep failed', err);
  }
  return evicted;
}

export function initSocketIO(httpServer: HttpServer): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.ALLOWED_ORIGINS?.split(',') || [
        'https://cardxc.online',
        'https://www.cardxc.online',
        'http://localhost:5173',
        'http://localhost:5000',
      ],
      credentials: true,
      methods: ['GET', 'POST'],
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // Authentication middleware
  io.use(async (socket: AuthenticatedSocket, next) => {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.replace('Bearer ', '');
    const auth = await authenticateSocketToken(token);
    if (!auth) {
      return next(new Error('Authentication failed'));
    }
    socket.userId = auth.userId;
    socket.userRole = auth.role;
    // Retain the token so protected events can revalidate the live DB session
    // (handshake-only validation is insufficient once a session is revoked).
    socket.data.token = token;
    next();
  });

  io.on('connection', (socket: AuthenticatedSocket) => {
    const userId = socket.userId!;
    const userRole = socket.userRole || 'user';

    logger.info(`[Socket] User ${userId} connected (${socket.id})`);

    // Track online users
    if (!onlineUsers.has(userId)) {
      onlineUsers.set(userId, new Set());
    }
    onlineUsers.get(userId)!.add(socket.id);

    // Join personal room
    socket.join(`user:${userId}`);

    // Admins join admin room. Roles in this system are 'USER' / 'SUPER_ADMIN'.
    if (userRole === 'SUPER_ADMIN') {
      socket.join(ADMIN_ROOM);
      // Notify admins of online count
      broadcastAdminStats();
    }

    // Notify admin room of new online user
    broadcastOnlineCount();

    // ---- Event Handlers ----

    // Client requests current balance
    socket.on('get:balance', async () => {
      if (!(await revalidateSocketSession(socket))) return;
      try {
        const result = await pool.query(
          'SELECT balance, currency FROM wallets WHERE user_id = $1',
          [userId]
        );
        if (result.rows.length > 0) {
          socket.emit('balance:update', {
            balance: result.rows[0].balance,
            currency: result.rows[0].currency,
          });
        }
      } catch (err) {
        logger.error('[Socket] get:balance error:', err);
      }
    });

    // Client requests recent transactions
    socket.on('get:transactions', async (limit = 10) => {
      if (!(await revalidateSocketSession(socket))) return;
      try {
        const result = await pool.query(
          `SELECT id, type, amount, currency, status, description, created_at
           FROM transactions WHERE user_id = $1
           ORDER BY created_at DESC LIMIT $2`,
          [userId, Math.min(limit, 50)]
        );
        socket.emit('transactions:list', result.rows);
      } catch (err) {
        logger.error('[Socket] get:transactions error:', err);
      }
    });

    // Admin requests live stats — revalidate the live session AND the current
    // role (a downgraded/revoked admin must not receive admin stats).
    socket.on('get:admin:stats', async () => {
      const live = await revalidateSocketSession(socket);
      if (!live) return;
      if (live.role !== 'SUPER_ADMIN') return;
      await sendAdminStats(socket);
    });

    // Disconnect
    socket.on('disconnect', (reason) => {
      logger.info(`[Socket] User ${userId} disconnected: ${reason}`);

      const userSockets = onlineUsers.get(userId);
      if (userSockets) {
        userSockets.delete(socket.id);
        if (userSockets.size === 0) {
          onlineUsers.delete(userId);
        }
      }

      broadcastOnlineCount();
    });
  });

  // Periodically re-authorize idle admin sockets so a logout/demotion takes
  // effect without requiring the client to emit anything or reconnect.
  if (adminSweepTimer) clearInterval(adminSweepTimer);
  adminSweepTimer = setInterval(() => {
    if (io) void sweepAdminRoom(io as unknown as { in: (room: string) => { fetchSockets: () => Promise<any[]> } });
  }, ADMIN_SWEEP_INTERVAL_MS);
  adminSweepTimer.unref?.();

  logger.info('[Socket] Socket.IO initialized');
  return io;
}

// ---- Emitter Functions (called from routes/services) ----

/** Emit balance update to a specific user */
export function emitBalanceUpdate(userId: string, balance: string, currency = 'USD') {
  if (!io) return;
  io.to(`user:${userId}`).emit('balance:update', { balance, currency });
}

/** Emit a new transaction notification to a user */
export function emitTransactionUpdate(
  userId: string,
  transaction: {
    id: number;
    type: string;
    amount: string;
    currency: string;
    status: string;
    description?: string;
    created_at: string;
  }
) {
  if (!io) return;
  io.to(`user:${userId}`).emit('transaction:new', transaction);

  // Also notify admins
  io.to(ADMIN_ROOM).emit('admin:transaction:new', { userId, transaction });
}

/** Emit a notification to a user */
export function emitNotification(
  userId: string,
  notification: {
    type: string;
    title: string;
    message: string;
    data?: Record<string, unknown>;
  }
) {
  if (!io) return;
  io.to(`user:${userId}`).emit('notification', notification);
}

/** Emit card status update to a user */
export function emitCardUpdate(
  userId: string,
  card: { id: number; status: string; last4?: string }
) {
  if (!io) return;
  io.to(`user:${userId}`).emit('card:update', card);
}

/** Emit withdrawal status update */
export function emitWithdrawalUpdate(
  userId: string,
  withdrawal: { id: number; status: string; amount: string }
) {
  if (!io) return;
  io.to(`user:${userId}`).emit('withdrawal:update', withdrawal);
  io.to(ADMIN_ROOM).emit('admin:withdrawal:update', { userId, withdrawal });
}

/** Broadcast to all admins */
export function emitAdminAlert(
  type: string,
  data: Record<string, unknown>
) {
  if (!io) return;
  io.to(ADMIN_ROOM).emit('admin:alert', { type, data, timestamp: new Date().toISOString() });
}

/** Get count of online users */
export function getOnlineUserCount(): number {
  return onlineUsers.size;
}

/** Check if a specific user is online */
export function isUserOnline(userId: string): boolean {
  return onlineUsers.has(userId) && (onlineUsers.get(userId)?.size ?? 0) > 0;
}

// ---- Internal helpers ----

function broadcastOnlineCount() {
  if (!io) return;
  io.to(ADMIN_ROOM).emit('admin:online_users', { count: onlineUsers.size });
}

async function sendAdminStats(socket: AuthenticatedSocket) {
  try {
    const [usersRes, txRes, pendingRes, balanceRes] = await Promise.all([
      pool.query('SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL \'24 hours\') as today FROM users'),
      pool.query('SELECT COUNT(*) as total, COALESCE(SUM(amount::numeric), 0) as volume FROM transactions WHERE created_at > NOW() - INTERVAL \'24 hours\''),
      pool.query('SELECT COUNT(*) as count FROM withdrawal_requests WHERE status = \'pending\''),
      pool.query('SELECT COALESCE(SUM(balance::numeric), 0) as total FROM wallets'),
    ]);

    socket.emit('admin:stats', {
      users: {
        total: parseInt(usersRes.rows[0].total),
        today: parseInt(usersRes.rows[0].today),
      },
      transactions: {
        today: parseInt(txRes.rows[0].total),
        volume24h: parseFloat(txRes.rows[0].volume).toFixed(2),
      },
      pendingWithdrawals: parseInt(pendingRes.rows[0].count),
      totalBalance: parseFloat(balanceRes.rows[0].total).toFixed(2),
      onlineUsers: onlineUsers.size,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    logger.error('[Socket] sendAdminStats error:', err);
  }
}

async function broadcastAdminStats() {
  if (!io) return;
  const adminSockets = await io.in(ADMIN_ROOM).fetchSockets();
  if (adminSockets.length === 0) return;

  try {
    const [usersRes, pendingRes] = await Promise.all([
      pool.query('SELECT COUNT(*) as total FROM users'),
      pool.query('SELECT COUNT(*) as count FROM withdrawal_requests WHERE status = \'pending\''),
    ]);

    io.to(ADMIN_ROOM).emit('admin:stats:quick', {
      totalUsers: parseInt(usersRes.rows[0].total),
      pendingWithdrawals: parseInt(pendingRes.rows[0].count),
      onlineUsers: onlineUsers.size,
    });
  } catch (err) {
    logger.error('[Socket] broadcastAdminStats error:', err);
  }
}

export { io };
