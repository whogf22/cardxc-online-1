import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import { logger } from '../middleware/logger';
import { pool } from '../db/pool';
import jwt from 'jsonwebtoken';
import { getJwtSecret } from '../lib/jwtSecret';

interface AuthenticatedSocket extends Socket {
  userId?: number;
  userRole?: string;
}

let io: SocketIOServer | null = null;

// Track online users: userId -> Set of socketIds
const onlineUsers = new Map<number, Set<string>>();

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
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) {
        return next(new Error('Authentication required'));
      }

      // getJwtSecret() throws at startup if SESSION_SECRET/JWT_SECRET is
      // missing or too short, so we never accept a socket connection with an
      // invalid signing key.
      const decoded = jwt.verify(token, getJwtSecret(), { algorithms: ['HS256'] }) as { userId: number; role?: string };

      // Verify user still exists in DB
      const result = await pool.query(
        'SELECT id, role FROM users WHERE id = $1 AND is_active = true',
        [decoded.userId]
      );

      if (result.rows.length === 0) {
        return next(new Error('User not found or inactive'));
      }

      socket.userId = decoded.userId;
      socket.userRole = result.rows[0].role;
      next();
    } catch (err) {
      next(new Error('Invalid token'));
    }
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

    // Admins join admin room
    if (userRole === 'admin' || userRole === 'super_admin') {
      socket.join('admin');
      // Notify admins of online count
      broadcastAdminStats();
    }

    // Notify admin room of new online user
    broadcastOnlineCount();

    // ---- Event Handlers ----

    // Client requests current balance
    socket.on('get:balance', async () => {
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

    // Admin requests live stats
    socket.on('get:admin:stats', async () => {
      if (userRole !== 'admin' && userRole !== 'super_admin') return;
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

  logger.info('[Socket] Socket.IO initialized');
  return io;
}

// ---- Emitter Functions (called from routes/services) ----

/** Emit balance update to a specific user */
export function emitBalanceUpdate(userId: number, balance: string, currency = 'USD') {
  if (!io) return;
  io.to(`user:${userId}`).emit('balance:update', { balance, currency });
}

/** Emit a new transaction notification to a user */
export function emitTransactionUpdate(
  userId: number,
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
  io.to('admin').emit('admin:transaction:new', { userId, transaction });
}

/** Emit a notification to a user */
export function emitNotification(
  userId: number,
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
  userId: number,
  card: { id: number; status: string; last4?: string }
) {
  if (!io) return;
  io.to(`user:${userId}`).emit('card:update', card);
}

/** Emit withdrawal status update */
export function emitWithdrawalUpdate(
  userId: number,
  withdrawal: { id: number; status: string; amount: string }
) {
  if (!io) return;
  io.to(`user:${userId}`).emit('withdrawal:update', withdrawal);
  io.to('admin').emit('admin:withdrawal:update', { userId, withdrawal });
}

/** Broadcast to all admins */
export function emitAdminAlert(
  type: string,
  data: Record<string, unknown>
) {
  if (!io) return;
  io.to('admin').emit('admin:alert', { type, data, timestamp: new Date().toISOString() });
}

/** Get count of online users */
export function getOnlineUserCount(): number {
  return onlineUsers.size;
}

/** Check if a specific user is online */
export function isUserOnline(userId: number): boolean {
  return onlineUsers.has(userId) && (onlineUsers.get(userId)?.size ?? 0) > 0;
}

// ---- Internal helpers ----

function broadcastOnlineCount() {
  if (!io) return;
  io.to('admin').emit('admin:online_users', { count: onlineUsers.size });
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
  const adminSockets = await io.in('admin').fetchSockets();
  if (adminSockets.length === 0) return;

  try {
    const [usersRes, pendingRes] = await Promise.all([
      pool.query('SELECT COUNT(*) as total FROM users'),
      pool.query('SELECT COUNT(*) as count FROM withdrawal_requests WHERE status = \'pending\''),
    ]);

    io.to('admin').emit('admin:stats:quick', {
      totalUsers: parseInt(usersRes.rows[0].total),
      pendingWithdrawals: parseInt(pendingRes.rows[0].count),
      onlineUsers: onlineUsers.size,
    });
  } catch (err) {
    logger.error('[Socket] broadcastAdminStats error:', err);
  }
}

export { io };
