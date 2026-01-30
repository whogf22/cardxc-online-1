import { Router, Response, Request } from 'express';
import { body, validationResult } from 'express-validator';
import { query, queryOne, transaction } from '../db/pool';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { authenticate, requireSuperAdmin, AuthenticatedRequest } from '../middleware/auth';
import { sensitiveOpLimiter } from '../middleware/rateLimit';
import { createAuditLog } from '../services/auditService';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../middleware/logger';
import crypto from 'crypto';

const checkoutRouter = Router();
const webhookRouter = Router();
const adminRouter = Router();

const PROVIDER_BASE_URL = process.env.FLUZ_BASE_URL || 'https://api-adapter.fluzapp.com/runa';
const PROVIDER_AUTH_BASIC = process.env.FLUZ_AUTH_BASIC;
const PROVIDER_WEBHOOK_SECRET = process.env.FLUZ_WEBHOOK_SECRET;
const USDT_RATE = parseFloat(process.env.USDT_RATE || '1.0');

function generateMerchantDisplayName(merchantName: string, transactionId: string): string {
  const last4 = transactionId.slice(-4);
  return `${merchantName} • ${last4}`;
}

function sanitizeSecret(secret: string | undefined): string {
  if (!secret) return '';
  return secret
    .replace(/[\r\n\t]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function getAuthHeader(): string {
  if (!PROVIDER_AUTH_BASIC) {
    throw new AppError('Payment provider not configured', 500, 'PROVIDER_NOT_CONFIGURED');
  }
  
  const cleanToken = sanitizeSecret(PROVIDER_AUTH_BASIC);
  
  if (cleanToken.toLowerCase().startsWith('basic ')) {
    return cleanToken;
  }
  
  return `Basic ${cleanToken}`;
}

function detectEnvironmentMismatch(): void {
  const baseUrl = PROVIDER_BASE_URL.toLowerCase();
  const isStaging = baseUrl.includes('staging') || baseUrl.includes('sandbox') || baseUrl.includes('test');
  const isProd = baseUrl.includes('api-adapter.fluzapp.com') && !isStaging;
  
  if (isProd) {
    logger.info('Payment provider configured for production environment');
  } else if (isStaging) {
    logger.info('Payment provider configured for staging/sandbox environment');
  }
}

function validateAuthHeaderFormat(): { valid: boolean; format: string } {
  if (!PROVIDER_AUTH_BASIC) {
    return { valid: false, format: 'missing' };
  }
  
  const cleanToken = sanitizeSecret(PROVIDER_AUTH_BASIC);
  
  if (cleanToken.toLowerCase().startsWith('basic basic')) {
    return { valid: false, format: 'double_prefix' };
  }
  
  if (cleanToken.toLowerCase().startsWith('basic ')) {
    const base64Part = cleanToken.substring(6).trim();
    if (base64Part.length < 10) {
      return { valid: false, format: 'too_short' };
    }
    return { valid: true, format: 'ok' };
  }
  
  if (cleanToken.length < 10) {
    return { valid: false, format: 'too_short' };
  }
  
  return { valid: true, format: 'ok' };
}

async function testProviderConnection(): Promise<{ success: boolean; error?: string }> {
  try {
    const authHeader = getAuthHeader();
    
    const response = await fetch(`${PROVIDER_BASE_URL}/v2/balance?currency=USD`, {
      method: 'GET',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
    });
    
    if (response.ok) {
      return { success: true };
    }
    
    if (response.status === 401) {
      logger.error('Provider auth failed. Check correct environment token (staging vs prod).');
      return { success: false, error: 'auth_failed' };
    }
    
    return { success: false, error: `status_${response.status}` };
  } catch (error: any) {
    logger.error('Provider connection test failed:', { error: error.message });
    return { success: false, error: 'connection_failed' };
  }
}

async function callProviderApi(endpoint: string, method: string, body?: any, idempotencyKey?: string): Promise<any> {
  const authHeader = getAuthHeader();

  const headers: Record<string, string> = {
    'Authorization': authHeader,
    'Content-Type': 'application/json',
  };
  
  if (idempotencyKey) {
    headers['X-Idempotency-Key'] = idempotencyKey;
  }

  const response = await fetch(`${PROVIDER_BASE_URL}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error('Payment provider API error:', { 
      endpoint, 
      status: response.status, 
      errorResponse: errorText.substring(0, 500),
      url: `${PROVIDER_BASE_URL}${endpoint}`
    });
    throw new AppError('Payment processing failed', response.status, 'PROVIDER_API_ERROR');
  }

  return response.json();
}

checkoutRouter.post('/card',
  authenticate,
  sensitiveOpLimiter,
  body('amount').isFloat({ min: 100, max: 2500 }).withMessage('Amount must be between 100 and 2500'),
  body('currency').isIn(['USD', 'EUR', 'GBP']),
  body('merchantName').trim().isLength({ min: 1, max: 255 }),
  body('targetUserId').optional().isUUID().withMessage('Invalid target user ID'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const firstError = errors.array()[0];
      const errorMessage = firstError.msg || 'Validation failed';
      throw new AppError(errorMessage, 400, 'VALIDATION_ERROR');
    }

    const { amount, currency, merchantName, metadata, targetUserId } = req.body;
    
    const roundedAmount = Math.round(Number(amount) * 100) / 100;
    if (isNaN(roundedAmount) || roundedAmount < 100 || roundedAmount > 2500) {
      throw new AppError('Amount must be between 100 and 2500', 400, 'VALIDATION_ERROR');
    }
    
    const amountCents = Math.round(roundedAmount * 100);
    
    const createdByUserId = req.user!.id;
    let depositTargetUserId = req.user!.id;
    
    if (targetUserId && targetUserId !== req.user!.id) {
      if (req.user!.role !== 'SUPER_ADMIN') {
        throw new AppError('Only SUPER_ADMIN can create deposits for other users', 403, 'FORBIDDEN');
      }
      const targetUser = await queryOne<{ id: string }>(`SELECT id FROM users WHERE id = $1`, [targetUserId]);
      if (!targetUser) {
        throw new AppError('Target user not found', 404, 'USER_NOT_FOUND');
      }
      depositTargetUserId = targetUserId;
    }

    const orderResult = await queryOne<{ id: string }>(`
      INSERT INTO card_orders (user_id, created_by_user_id, target_user_id, amount_cents, currency, merchant_name, status, metadata)
      VALUES ($1, $2, $3, $4, $5, $6, 'PENDING', $7)
      RETURNING id
    `, [depositTargetUserId, createdByUserId, depositTargetUserId, amountCents, currency, merchantName, metadata ? JSON.stringify(metadata) : null]);

    if (!orderResult) {
      throw new AppError('Failed to create order', 500, 'ORDER_CREATE_FAILED');
    }

    const orderId = orderResult.id;

    let checkoutUrl: string;
    let providerPaymentId: string;

    if (PROVIDER_AUTH_BASIC) {
      try {
        const faceValue = amountCents / 100;
        
        const orderPayload = {
          payment_method: {
            type: "ACCOUNT_BALANCE",
            currency: currency
          },
          items: [
            {
              face_value: faceValue,
              external_ref: orderId,
              distribution_method: {
                type: "PAYOUT_LINK"
              },
              products: {
                type: "SINGLE",
                value: "1800FL-US"
              }
            }
          ]
        };
        
        const providerResponse = await callProviderApi('/v2/order', 'POST', orderPayload, orderId);
        
        logger.info('Provider order created', { 
          orderId, 
          providerOrderId: providerResponse.id,
          status: providerResponse.status,
          itemsCount: providerResponse.items?.length,
          firstItem: providerResponse.items?.[0] ? JSON.stringify(providerResponse.items[0]).substring(0, 200) : 'none'
        });
        
        const item = providerResponse.items?.[0];
        checkoutUrl = item?.payout_link || item?.redemption_url || item?.link || providerResponse.checkout_url || '';
        providerPaymentId = providerResponse.id || providerResponse.order_id || orderId;
        
        if (!checkoutUrl && providerResponse.status === 'IN_PROGRESS') {
          checkoutUrl = `${process.env.APP_URL || 'https://cardxc.online'}/wallet?payment=processing&order=${orderId}`;
        }
      } catch (error: any) {
        await query('UPDATE card_orders SET status = $1, updated_at = NOW() WHERE id = $2', ['FAILED', orderId]);
        logger.error('Payment provider call failed:', { error: error.message, orderId });
        throw new AppError('Payment service is temporarily unavailable. Please try again later.', 503, 'PAYMENT_SERVICE_UNAVAILABLE');
      }
    } else {
      providerPaymentId = `pay_sim_${uuidv4()}`;
      checkoutUrl = `${process.env.APP_URL || 'https://cardxc.online'}/checkout/simulate/${providerPaymentId}`;
      logger.warn('Payment provider not configured - using simulated checkout URL');
    }

    await query(`
      UPDATE card_orders 
      SET provider_payment_id = $1, checkout_url = $2, updated_at = NOW()
      WHERE id = $3
    `, [providerPaymentId, checkoutUrl, orderId]);

    await createAuditLog({
      userId: req.user!.id,
      action: 'CARD_CHECKOUT_CREATED',
      entityType: 'card_order',
      entityId: orderId,
      newValues: { amount: amountCents, currency, merchantName },
    });

    res.status(201).json({
      success: true,
      data: {
        checkoutUrl,
      }
    });
  })
);

webhookRouter.post('/payment',
  asyncHandler(async (req: Request, res: Response) => {
    const signature = req.headers['x-webhook-signature'] as string || req.headers['x-fluz-signature'] as string || '';
    const payload = req.body;

    const logId = await queryOne<{ id: string }>(`
      INSERT INTO payment_webhook_logs (event_type, payload, signature, processed)
      VALUES ($1, $2, $3, FALSE)
      RETURNING id
    `, [payload.event || 'unknown', JSON.stringify(payload), signature]);

    if (PROVIDER_WEBHOOK_SECRET && signature) {
      const expectedSignature = crypto
        .createHmac('sha256', PROVIDER_WEBHOOK_SECRET)
        .update(JSON.stringify(payload))
        .digest('hex');

      if (signature !== expectedSignature) {
        await query(`
          UPDATE payment_webhook_logs SET error_message = 'Invalid signature' WHERE id = $1
        `, [logId?.id]);
        logger.warn('Invalid payment webhook signature');
        return res.status(401).json({ success: false, error: 'Invalid signature' });
      }
    }

    const { event, paymentId, status } = payload;

    if (!paymentId) {
      await query(`
        UPDATE payment_webhook_logs SET error_message = 'Missing paymentId', processed = TRUE WHERE id = $1
      `, [logId?.id]);
      return res.status(400).json({ success: false, error: 'Missing paymentId' });
    }

    const order = await queryOne<any>(`
      SELECT * FROM card_orders WHERE provider_payment_id = $1
    `, [paymentId]);

    if (!order) {
      await query(`
        UPDATE payment_webhook_logs SET error_message = 'Order not found', processed = TRUE WHERE id = $1
      `, [logId?.id]);
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    if (order.status === 'COMPLETED') {
      await query(`
        UPDATE payment_webhook_logs SET error_message = 'Order already completed (idempotent)', processed = TRUE WHERE id = $1
      `, [logId?.id]);
      return res.json({ success: true, message: 'Already processed' });
    }

    if (event === 'payment.completed' || status === 'completed') {
      try {
        const creditUserId = order.target_user_id || order.user_id;
        
        await transaction(async (client) => {
          const txResult = await client.query(`
            INSERT INTO transactions (
              user_id, idempotency_key, type, status, amount_cents, currency, 
              description, merchant_name, merchant_display_name, metadata
            )
            VALUES ($1, $2, 'deposit', 'SUCCESS', $3, $4, $5, $6, $7, $8)
            RETURNING id
          `, [
            creditUserId,
            `card_${paymentId}`,
            order.amount_cents,
            order.currency,
            `Card Deposit - ${order.merchant_name}`,
            order.merchant_name,
            null,
            JSON.stringify({ paymentId: paymentId, orderId: order.id, createdBy: order.created_by_user_id })
          ]);

          const transactionId = txResult.rows[0].id;

          const merchantDisplayName = generateMerchantDisplayName(order.merchant_name || 'Card Deposit', transactionId);
          await client.query(`
            UPDATE transactions SET merchant_display_name = $1 WHERE id = $2
          `, [merchantDisplayName, transactionId]);

          await client.query(`
            INSERT INTO wallets (user_id, currency, balance_cents)
            VALUES ($1, $2, $3)
            ON CONFLICT (user_id, currency) 
            DO UPDATE SET balance_cents = wallets.balance_cents + $3, updated_at = NOW()
          `, [creditUserId, order.currency, order.amount_cents]);

          const usdtAmountCents = Math.round(order.amount_cents / USDT_RATE);
          
          await client.query(`
            INSERT INTO wallets (user_id, currency, balance_cents, usdt_balance_cents)
            VALUES ($1, 'USD', 0, $2)
            ON CONFLICT (user_id, currency) 
            DO UPDATE SET usdt_balance_cents = COALESCE(wallets.usdt_balance_cents, 0) + $2, updated_at = NOW()
          `, [creditUserId, usdtAmountCents]);

          await client.query(`
            INSERT INTO crypto_ledger_entries (user_id, source_order_id, source_transaction_id, crypto_type, amount_cents, exchange_rate, usd_equivalent_cents, description)
            VALUES ($1, $2, $3, 'USDT', $4, $5, $6, $7)
            ON CONFLICT (source_order_id, user_id) DO NOTHING
          `, [creditUserId, order.id, transactionId, usdtAmountCents, USDT_RATE, order.amount_cents, `Auto USDT credit from card deposit`]);

          await client.query(`
            UPDATE card_orders SET status = 'COMPLETED', transaction_id = $1, updated_at = NOW() WHERE id = $2
          `, [transactionId, order.id]);

          await client.query(`
            UPDATE payment_webhook_logs SET processed = TRUE WHERE id = $1
          `, [logId?.id]);
        });

        await createAuditLog({
          userId: creditUserId,
          action: 'CARD_PAYMENT_COMPLETED',
          entityType: 'card_order',
          entityId: order.id,
          newValues: { amount: order.amount_cents, currency: order.currency },
        });

        logger.info('Card payment completed and wallet credited', { orderId: order.id, userId: order.user_id });
      } catch (error: any) {
        await query(`
          UPDATE payment_webhook_logs SET error_message = $1, processed = TRUE WHERE id = $2
        `, [error.message, logId?.id]);
        
        if (error.message?.includes('duplicate key')) {
          return res.json({ success: true, message: 'Already processed (idempotent)' });
        }
        throw error;
      }
    } else if (event === 'payment.failed' || status === 'failed') {
      await query(`
        UPDATE card_orders SET status = 'FAILED', updated_at = NOW() WHERE id = $1
      `, [order.id]);
      
      await query(`
        UPDATE payment_webhook_logs SET processed = TRUE WHERE id = $1
      `, [logId?.id]);

      await createAuditLog({
        userId: order.user_id,
        action: 'CARD_PAYMENT_FAILED',
        entityType: 'card_order',
        entityId: order.id,
      });
    } else if (event === 'payment.expired' || status === 'expired') {
      await query(`
        UPDATE card_orders SET status = 'EXPIRED', updated_at = NOW() WHERE id = $1
      `, [order.id]);
      
      await query(`
        UPDATE payment_webhook_logs SET processed = TRUE WHERE id = $1
      `, [logId?.id]);
    }

    res.json({ success: true });
  })
);

adminRouter.get('/orders',
  authenticate,
  requireSuperAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { limit = 50, offset = 0, status, userId } = req.query;
    
    let whereClause = 'WHERE 1=1';
    const params: any[] = [];
    let paramIndex = 1;

    if (status) {
      whereClause += ` AND co.status = $${paramIndex++}`;
      params.push(status);
    }

    if (userId) {
      whereClause += ` AND co.user_id = $${paramIndex++}`;
      params.push(userId);
    }

    const orders = await query(`
      SELECT 
        co.id,
        co.user_id,
        co.amount_cents,
        co.currency,
        co.merchant_name,
        co.status,
        co.transaction_id,
        co.created_at,
        co.updated_at,
        u.email as user_email,
        u.full_name as user_name
      FROM card_orders co
      LEFT JOIN users u ON co.user_id = u.id
      ${whereClause}
      ORDER BY co.created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex}
    `, [...params, Number(limit), Number(offset)]);

    const countResult = await queryOne<{ count: string }>(`
      SELECT COUNT(*) as count FROM card_orders co ${whereClause}
    `, params);

    res.json({
      success: true,
      data: {
        orders: orders.map(o => ({
          ...o,
          amount: Number(o.amount_cents) / 100,
        })),
        total: parseInt(countResult?.count || '0'),
        limit: Number(limit),
        offset: Number(offset),
      }
    });
  })
);

adminRouter.get('/webhook-logs',
  authenticate,
  requireSuperAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { limit = 50, offset = 0, processed } = req.query;
    
    let whereClause = 'WHERE 1=1';
    const params: any[] = [];
    let paramIndex = 1;

    if (processed !== undefined) {
      whereClause += ` AND processed = $${paramIndex++}`;
      params.push(processed === 'true');
    }

    const logs = await query(`
      SELECT id, event_type, processed, error_message, created_at FROM payment_webhook_logs
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex}
    `, [...params, Number(limit), Number(offset)]);

    const countResult = await queryOne<{ count: string }>(`
      SELECT COUNT(*) as count FROM payment_webhook_logs ${whereClause}
    `, params);

    res.json({
      success: true,
      data: {
        logs,
        total: parseInt(countResult?.count || '0'),
        limit: Number(limit),
        offset: Number(offset),
      }
    });
  })
);

adminRouter.post('/orders/:orderId/retry',
  authenticate,
  requireSuperAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const orderId = req.params.orderId as string;
    
    const order = await queryOne<any>(`
      SELECT * FROM card_orders WHERE id = $1 AND status = 'FAILED'
    `, [orderId]);

    if (!order) {
      throw new AppError('Order not found or not in FAILED status', 404, 'ORDER_NOT_FOUND');
    }

    await query(`
      UPDATE card_orders SET status = 'PENDING', updated_at = NOW() WHERE id = $1
    `, [orderId]);

    await createAuditLog({
      userId: req.user!.id,
      action: 'CARD_ORDER_RETRY',
      entityType: 'card_order',
      entityId: orderId,
      newValues: { previousStatus: 'FAILED', newStatus: 'PENDING' },
    });

    res.json({
      success: true,
      message: 'Order marked for retry',
    });
  })
);

adminRouter.get('/crypto-ledger',
  authenticate,
  requireSuperAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { limit = 50, offset = 0, userId } = req.query;
    
    let whereClause = 'WHERE 1=1';
    const params: any[] = [];
    let paramIndex = 1;

    if (userId) {
      whereClause += ` AND cl.user_id = $${paramIndex++}`;
      params.push(userId);
    }

    const entries = await query(`
      SELECT 
        cl.id,
        cl.user_id,
        cl.source_order_id,
        cl.source_transaction_id,
        cl.crypto_type,
        cl.amount_cents,
        cl.exchange_rate,
        cl.usd_equivalent_cents,
        cl.description,
        cl.created_at,
        u.email as user_email
      FROM crypto_ledger_entries cl
      LEFT JOIN users u ON cl.user_id = u.id
      ${whereClause}
      ORDER BY cl.created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex}
    `, [...params, Number(limit), Number(offset)]);

    const countResult = await queryOne<{ count: string }>(`
      SELECT COUNT(*) as count FROM crypto_ledger_entries cl ${whereClause}
    `, params);

    res.json({
      success: true,
      data: {
        entries: entries.map(e => ({
          ...e,
          amount: Number(e.amount_cents) / 100,
          usdEquivalent: Number(e.usd_equivalent_cents) / 100,
        })),
        total: parseInt(countResult?.count || '0'),
        limit: Number(limit),
        offset: Number(offset),
      }
    });
  })
);

adminRouter.get('/provider-auth-status',
  authenticate,
  requireSuperAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const validation = validateAuthHeaderFormat();
    
    res.json({
      success: true,
      data: {
        configured: !!PROVIDER_AUTH_BASIC,
        authHeaderFormat: validation.format,
        baseUrl: PROVIDER_BASE_URL ? 'configured' : 'missing'
      }
    });
  })
);

adminRouter.get('/provider-live-ping',
  authenticate,
  requireSuperAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!PROVIDER_AUTH_BASIC) {
      res.json({
        success: false,
        error: { code: 'PROVIDER_NOT_CONFIGURED', message: 'Payment provider not configured.' }
      });
      return;
    }
    
    detectEnvironmentMismatch();
    
    const result = await testProviderConnection();
    
    if (result.success) {
      res.json({
        success: true,
        data: { reachable: true }
      });
    } else {
      res.json({
        success: false,
        error: { code: 'PROVIDER_AUTH_FAILED', message: 'Payment service unavailable.' }
      });
    }
  })
);

export { checkoutRouter as cardCheckoutRouter, webhookRouter as paymentWebhookRouter, adminRouter as paymentAdminRouter };
