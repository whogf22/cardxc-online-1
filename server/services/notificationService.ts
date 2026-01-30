import { query, queryOne } from '../db/pool';
import { logger } from '../middleware/logger';

export type NotificationType = 
  | 'transaction_received'
  | 'transaction_sent'
  | 'deposit_completed'
  | 'withdrawal_approved'
  | 'withdrawal_rejected'
  | 'card_frozen'
  | 'card_unfrozen'
  | 'security_alert'
  | 'account_update'
  | 'promotion';

interface CreateNotificationParams {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  metadata?: Record<string, any>;
}

export async function createNotification(params: CreateNotificationParams): Promise<string | null> {
  try {
    const result = await queryOne<{ id: string }>(`
      INSERT INTO notifications (user_id, type, title, message, metadata)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `, [params.userId, params.type, params.title, params.message, JSON.stringify(params.metadata || {})]);
    
    logger.info(`[Notification] Created notification for user ${params.userId}: ${params.type}`);
    return result?.id || null;
  } catch (err) {
    logger.error('[Notification] Error creating notification:', err);
    return null;
  }
}

export async function getUserNotifications(userId: string, limit = 50, includeRead = false) {
  const whereClause = includeRead ? '' : 'AND read = FALSE';
  return query(`
    SELECT id, type, title, message, read, metadata, created_at
    FROM notifications
    WHERE user_id = $1 ${whereClause}
    ORDER BY created_at DESC
    LIMIT $2
  `, [userId, limit]);
}

export async function markNotificationRead(notificationId: string, userId: string): Promise<boolean> {
  try {
    await query(`
      UPDATE notifications SET read = TRUE
      WHERE id = $1 AND user_id = $2
    `, [notificationId, userId]);
    return true;
  } catch (err) {
    logger.error('[Notification] Error marking notification read:', err);
    return false;
  }
}

export async function markAllNotificationsRead(userId: string): Promise<boolean> {
  try {
    await query(`
      UPDATE notifications SET read = TRUE
      WHERE user_id = $1 AND read = FALSE
    `, [userId]);
    return true;
  } catch (err) {
    logger.error('[Notification] Error marking all notifications read:', err);
    return false;
  }
}

export async function getUnreadCount(userId: string): Promise<number> {
  const result = await queryOne<{ count: string }>(`
    SELECT COUNT(*) as count FROM notifications
    WHERE user_id = $1 AND read = FALSE
  `, [userId]);
  return parseInt(result?.count || '0');
}

// Helper functions for common notification types
export async function notifyTransactionReceived(userId: string, amount: number, currency: string, senderName: string) {
  return createNotification({
    userId,
    type: 'transaction_received',
    title: 'Money Received',
    message: `You received ${currency} ${amount.toFixed(2)} from ${senderName}`,
    metadata: { amount, currency, senderName },
  });
}

export async function notifyTransactionSent(userId: string, amount: number, currency: string, recipientName: string) {
  return createNotification({
    userId,
    type: 'transaction_sent',
    title: 'Transfer Successful',
    message: `You sent ${currency} ${amount.toFixed(2)} to ${recipientName}`,
    metadata: { amount, currency, recipientName },
  });
}

export async function notifyDepositCompleted(userId: string, amount: number, currency: string) {
  return createNotification({
    userId,
    type: 'deposit_completed',
    title: 'Deposit Successful',
    message: `${currency} ${amount.toFixed(2)} has been added to your wallet`,
    metadata: { amount, currency },
  });
}

export async function notifyWithdrawalApproved(userId: string, amount: number, currency: string) {
  return createNotification({
    userId,
    type: 'withdrawal_approved',
    title: 'Withdrawal Approved',
    message: `Your withdrawal of ${currency} ${amount.toFixed(2)} has been approved`,
    metadata: { amount, currency },
  });
}

export async function notifyWithdrawalRejected(userId: string, amount: number, currency: string, reason: string) {
  return createNotification({
    userId,
    type: 'withdrawal_rejected',
    title: 'Withdrawal Rejected',
    message: `Your withdrawal of ${currency} ${amount.toFixed(2)} was rejected: ${reason}`,
    metadata: { amount, currency, reason },
  });
}

export async function notifyCardFrozen(userId: string, cardName: string, lastFour: string) {
  return createNotification({
    userId,
    type: 'card_frozen',
    title: 'Card Frozen',
    message: `Your card ${cardName} (****${lastFour}) has been frozen`,
    metadata: { cardName, lastFour },
  });
}

export async function notifySecurityAlert(userId: string, alertType: string, details: string) {
  return createNotification({
    userId,
    type: 'security_alert',
    title: 'Security Alert',
    message: details,
    metadata: { alertType },
  });
}
