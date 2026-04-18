import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import jwt from 'jsonwebtoken';
import { logger } from '../middleware/logger';
import { query, queryOne } from '../db/pool';
import { getJwtSecret } from '../lib/jwtSecret';

interface UserSocket {
  userId: string;
  socket: Socket;
}

const userSockets: Map<string, Socket[]> = new Map();

export function initializeWebSocket(httpServer: HTTPServer): SocketIOServer {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL || 'https://cardxc.online',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error('Authentication error: token required'));
    }
    try {
      // getJwtSecret() throws at startup if the secret is missing or too
      // short, so we never accept a socket connection with an invalid key.
      const decoded = jwt.verify(token, getJwtSecret(), { algorithms: ['HS256'] }) as { userId: string };
      if (!decoded.userId) {
        return next(new Error('Authentication error: invalid token'));
      }
      socket.data.userId = decoded.userId;
      next();
    } catch (err) {
      return next(new Error('Authentication error: invalid token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const userId = socket.data.userId;
    logger.info('websocket_connected', { userId, socketId: socket.id });

    // Track user sockets
    if (!userSockets.has(userId)) {
      userSockets.set(userId, []);
    }
    userSockets.get(userId)!.push(socket);

    // Join user-specific room
    socket.join(`user:${userId}`);

    // Handle disconnect
    socket.on('disconnect', () => {
      logger.info('websocket_disconnected', { userId, socketId: socket.id });
      const sockets = userSockets.get(userId);
      if (sockets) {
        const index = sockets.indexOf(socket);
        if (index > -1) {
          sockets.splice(index, 1);
        }
        if (sockets.length === 0) {
          userSockets.delete(userId);
        }
      }
    });

    // Handle balance update request
    socket.on('request_balance_update', async () => {
      try {
        const wallet = await queryOne(`
          SELECT balance_cents, usdt_balance_cents, currency 
          FROM wallets 
          WHERE user_id = $1
        `, [userId]);

        if (wallet) {
          socket.emit('balance_updated', {
            balance: wallet.balance_cents / 100,
            usdtBalance: wallet.usdt_balance_cents / 100,
            currency: wallet.currency,
            timestamp: new Date().toISOString(),
          });
        }
      } catch (error) {
        logger.error('balance_update_error', { userId, error });
      }
    });

    // Handle transaction history request
    socket.on('request_transactions', async (options?: { limit?: number; offset?: number }) => {
      try {
        const limit = options?.limit || 20;
        const offset = options?.offset || 0;

        const transactions = await query(`
          SELECT id, type, amount_cents, currency, status, description, 
                 merchant_name, merchant_display_name, created_at
          FROM transactions
          WHERE user_id = $1
          ORDER BY created_at DESC
          LIMIT $2 OFFSET $3
        `, [userId, limit, offset]);

        socket.emit('transactions_updated', {
          transactions: transactions.map((t: any) => ({
            id: t.id,
            type: t.type,
            amount: t.amount_cents / 100,
            currency: t.currency,
            status: t.status,
            description: t.description,
            merchant: t.merchant_display_name || t.merchant_name,
            createdAt: t.created_at,
          })),
          count: transactions.length,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        logger.error('transactions_update_error', { userId, error });
      }
    });
  });

  return io;
}

/**
 * Emit balance update to all user's connected sockets
 */
export async function emitBalanceUpdate(userId: string, io: SocketIOServer) {
  try {
    const wallet = await queryOne(`
      SELECT balance_cents, usdt_balance_cents, currency 
      FROM wallets 
      WHERE user_id = $1
    `, [userId]);

    if (wallet) {
      io.to(`user:${userId}`).emit('balance_updated', {
        balance: wallet.balance_cents / 100,
        usdtBalance: wallet.usdt_balance_cents / 100,
        currency: wallet.currency,
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error) {
    logger.error('emit_balance_update_error', { userId, error });
  }
}

/**
 * Emit transaction update to all user's connected sockets
 */
export async function emitTransactionUpdate(userId: string, io: SocketIOServer, transactionId?: string) {
  try {
    const whereClause = transactionId
      ? 'WHERE user_id = $1 AND id = $2 ORDER BY created_at DESC LIMIT 1'
      : 'WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1';

    const params = transactionId ? [userId, transactionId] : [userId];

    const result = await query(`
      SELECT id, type, amount_cents, currency, status, description, 
             merchant_name, merchant_display_name, created_at
      FROM transactions
      ${whereClause}
    `, params);

    if (result.length > 0) {
      const t = result[0];
      io.to(`user:${userId}`).emit('transaction_created', {
        id: t.id,
        type: t.type,
        amount: t.amount_cents / 100,
        currency: t.currency,
        status: t.status,
        description: t.description,
        merchant: t.merchant_display_name || t.merchant_name,
        createdAt: t.created_at,
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error) {
    logger.error('emit_transaction_update_error', { userId, error });
  }
}

/**
 * Emit card update to all user's connected sockets
 */
export async function emitCardUpdate(userId: string, io: SocketIOServer, cardId?: string) {
  try {
    const whereClause = cardId
      ? 'WHERE user_id = $1 AND id = $2'
      : 'WHERE user_id = $1';

    const params = cardId ? [userId, cardId] : [userId];

    const result = await query(`
      SELECT id, card_name, card_type, status, last_four, 
             daily_limit_cents, monthly_limit_cents, created_at
      FROM virtual_cards
      ${whereClause}
      LIMIT 1
    `, params);

    if (result.length > 0) {
      const card = result[0];
      io.to(`user:${userId}`).emit('card_updated', {
        id: card.id,
        name: card.card_name,
        type: card.card_type,
        status: card.status,
        lastFour: card.last_four,
        dailyLimit: card.daily_limit_cents / 100,
        monthlyLimit: card.monthly_limit_cents / 100,
        createdAt: card.created_at,
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error) {
    logger.error('emit_card_update_error', { userId, error });
  }
}

/**
 * Emit OTP sent notification
 */
export function emitOTPSent(userId: string, io: SocketIOServer, email: string) {
  io.to(`user:${userId}`).emit('otp_sent', {
    message: `OTP sent to ${email}`,
    email,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Emit payment status update
 */
export function emitPaymentStatusUpdate(userId: string, io: SocketIOServer, status: string, orderId: string) {
  io.to(`user:${userId}`).emit('payment_status_updated', {
    orderId,
    status,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Get all connected sockets for a user
 */
export function getUserSockets(userId: string): Socket[] {
  return userSockets.get(userId) || [];
}

/**
 * Check if user is online
 */
export function isUserOnline(userId: string): boolean {
  return (userSockets.get(userId)?.length || 0) > 0;
}
