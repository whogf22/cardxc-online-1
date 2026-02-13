import { Router, Response, Request } from 'express';
import { body, validationResult } from 'express-validator';
import { query, queryOne, transaction } from '../db/pool';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { authenticate, requireSuperAdmin, AuthenticatedRequest } from '../middleware/auth';
import { sensitiveOpLimiter } from '../middleware/rateLimit';
import { createAuditLog } from '../services/auditService';
import {
  isFluzConfigured,
  getFluzBaseUrl,
  validateFluzAuthHeaderFormat,
  detectFluzEnvironmentMismatch,
  testFluzConnection,
  createFluzOrder,
  type FluzCreateOrderPayload,
} from '../services/fluzClient';
import { getCardProducts, getProviderProductId, validateCardAmount, calculateCardCheckoutCost } from '../services/cardProductService';
import { sendCryptoToWallet, isCryptoProviderConfigured } from '../services/cryptoProviderService';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../middleware/logger';
import crypto from 'crypto';

const checkoutRouter = Router();
const webhookRouter = Router();
const adminRouter = Router();

const PROVIDER_WEBHOOK_SECRET = process.env.FLUZ_WEBHOOK_SECRET;
const USDT_RATE = parseFloat(process.env.USDT_RATE || '1.0');
const REQUIRE_EMAIL_VERIFIED_FOR_CARD_CHECKOUT = process.env.REQUIRE_EMAIL_VERIFIED_FOR_CARD_CHECKOUT !== 'false';
const REQUIRE_KYC_FOR_CARD_CHECKOUT = process.env.REQUIRE_KYC_FOR_CARD_CHECKOUT === 'true';

function generateMerchantDisplayName(merchantName: string, transactionId: string): string {
  const last4 = transactionId.slice(-4);
  return `${merchantName} • ${last4}`;
}

// Get available card products
checkoutRouter.get('/card-products', authenticate, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const currency = (req.query.currency as string) || 'USD';
  const products = await getCardProducts(currency);

  res.json({
    success: true,
    data: { products }
  });
}));

checkoutRouter.post('/card',
  authenticate,
  sensitiveOpLimiter,
  body('amount').isFloat({ min: 100, max: 2500 }).withMessage('Amount must be between 100 and 2500'),
  body('currency').isIn(['USD', 'EUR', 'GBP']),
  body('productId').optional().trim().isLength({ min: 1, max: 100 }),
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

    // Eligibility checks: verified email and optional KYC
    const depositor = await queryOne<{ email_verified: boolean; kyc_status: string }>(`
      SELECT email_verified, kyc_status FROM users WHERE id = $1
    `, [depositTargetUserId]);
    if (!depositor) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }
    if (REQUIRE_EMAIL_VERIFIED_FOR_CARD_CHECKOUT && !depositor.email_verified) {
      throw new AppError('Please verify your email before adding funds with a card.', 403, 'EMAIL_VERIFICATION_REQUIRED');
    }
    if (REQUIRE_KYC_FOR_CARD_CHECKOUT && (depositor.kyc_status || '').toLowerCase() !== 'approved') {
      throw new AppError('Identity verification (KYC) is required before adding funds with a card.', 403, 'KYC_REQUIRED');
    }

    const roundedAmount = Math.round(Number(amount) * 100) / 100;
    if (isNaN(roundedAmount) || roundedAmount < 100 || roundedAmount > 2500) {
      throw new AppError('Amount must be between 100 and 2500', 400, 'VALIDATION_ERROR');
    }

    const amountCents = Math.round(roundedAmount * 100);

    const orderResult = await queryOne<{ id: string }>(`
      INSERT INTO card_orders (user_id, created_by_user_id, target_user_id, amount_cents, currency, merchant_name, status, metadata)
      VALUES ($1, $2, $3, $4, $5, $6, 'PENDING', $7)
      RETURNING id
    `, [depositTargetUserId, createdByUserId, depositTargetUserId, amountCents, currency, merchantName, metadata ? JSON.stringify(metadata) : null]);

    if (!orderResult) {
      throw new AppError('Failed to create order', 500, 'ORDER_CREATE_FAILED');
    }

    const orderId = orderResult.id;
    logger.info('checkout_order_created', { orderId, amountCents, currency });

    let checkoutUrl: string;
    let providerPaymentId: string;

    if (isFluzConfigured()) {
      try {
        const faceValue = amountCents / 100;
        const orderPayload: FluzCreateOrderPayload = {
          payment_method: { type: 'ACCOUNT_BALANCE', currency },
          items: [
            {
              face_value: faceValue,
              external_ref: orderId,
              distribution_method: { type: 'PAYOUT_LINK' },
              products: { type: 'SINGLE', value: '1800FL-US' },
            },
          ],
        };
        const providerResponse = await createFluzOrder(orderPayload, orderId);
        logger.info('checkout_provider_order_created', {
          orderId,
          providerOrderId: providerResponse.id,
          amountCents,
          currency,
          status: providerResponse.status,
        });
        const item = providerResponse.items?.[0];
        checkoutUrl =
          item?.payout_link || item?.redemption_url || item?.link || providerResponse.checkout_url || '';
        providerPaymentId = providerResponse.id || providerResponse.order_id || orderId;
        if (!checkoutUrl && providerResponse.status === 'IN_PROGRESS') {
          checkoutUrl = `${process.env.APP_URL || 'https://cardxc.online'}/wallet?payment=processing&order=${orderId}`;
        }
      } catch (error: any) {
        await query('UPDATE card_orders SET status = $1, updated_at = NOW() WHERE id = $2', ['FAILED', orderId]);
        logger.error('checkout_provider_order_failed', { orderId, amountCents, currency, error: error.message });
        throw new AppError('Payment service is temporarily unavailable. Please try again later.', 503, 'PAYMENT_SERVICE_UNAVAILABLE');
      }
    } else {
      providerPaymentId = `pay_sim_${uuidv4()}`;
      const appUrl = process.env.APP_URL || '';
      checkoutUrl = appUrl
        ? `${appUrl.replace(/\/$/, '')}/checkout/simulate/${providerPaymentId}`
        : `/checkout/simulate/${providerPaymentId}`;
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

    logger.info('checkout_url_returned', { orderId, providerOrderId: providerPaymentId, amountCents, currency });
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
    const signature = (req.headers['x-webhook-signature'] ?? req.headers['x-provider-signature']) as string ?? '';
    const payload = req.body && typeof req.body === 'object' ? req.body : {};
    const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
    const payloadForSignature = rawBody ? rawBody.toString('utf8') : JSON.stringify(payload);

    const eventType = payload.event ?? payload.type ?? 'unknown';
    const paymentId = payload.paymentId ?? payload.id ?? payload.orderId;

    // Idempotency: if we already processed this paymentId + event successfully, return 200 without inserting a log (reduce DB churn)
    if (paymentId) {
      const alreadyProcessedEarlier = await queryOne<{ id: string }>(`
        SELECT id FROM payment_webhook_logs
        WHERE processed = TRUE AND (error_message IS NULL OR error_message = '')
        AND event_type = $1
        AND (payload->>'paymentId' = $2 OR payload->>'id' = $2 OR payload->>'orderId' = $2)
        LIMIT 1
      `, [eventType, String(paymentId)]);
      if (alreadyProcessedEarlier) {
        logger.info('webhook_idempotent_skip_no_log', { paymentId, eventType });
        return res.json({ success: true, message: 'Already processed' });
      }
    }

    const logRow = await queryOne<{ id: string }>(`
      INSERT INTO payment_webhook_logs (event_type, payload, signature, processed)
      VALUES ($1, $2, $3, FALSE)
      RETURNING id
    `, [eventType, JSON.stringify(payload), signature]);

    const logId = logRow?.id;
    if (!logId) {
      logger.error('webhook_log_insert_failed', { eventType, paymentId });
      return res.status(500).json({ success: false, error: 'Failed to record webhook' });
    }

    logger.info('webhook_received', { logId, eventType, paymentId });

    if (PROVIDER_WEBHOOK_SECRET) {
      if (!signature) {
        await query(`UPDATE payment_webhook_logs SET error_message = 'Missing signature', processed = TRUE WHERE id = $1`, [logId]);
        logger.warn('webhook_missing_signature', { logId, eventType });
        return res.status(401).json({ success: false, error: 'Missing signature' });
      }
      const expectedSignature = crypto
        .createHmac('sha256', PROVIDER_WEBHOOK_SECRET)
        .update(payloadForSignature)
        .digest('hex');
      if (signature !== expectedSignature) {
        await query(`UPDATE payment_webhook_logs SET error_message = 'Invalid signature', processed = TRUE WHERE id = $1`, [logId]);
        logger.warn('webhook_invalid_signature', { logId, eventType, paymentId });
        return res.status(401).json({ success: false, error: 'Invalid signature' });
      }
      logger.info('webhook_signature_ok', { logId, eventType, paymentId });
    }

    if (!paymentId) {
      await query(`
        UPDATE payment_webhook_logs SET error_message = 'Missing paymentId', processed = TRUE WHERE id = $1
      `, [logId]);
      logger.warn('webhook_missing_paymentId', { logId, eventType });
      return res.status(400).json({ success: false, error: 'Missing paymentId' });
    }

    const alreadyProcessed = await queryOne<{ id: string }>(`
      SELECT id FROM payment_webhook_logs
      WHERE id != $1 AND processed = TRUE AND (error_message IS NULL OR error_message = '')
      AND event_type = $2
      AND (payload->>'paymentId' = $3 OR payload->>'id' = $3 OR payload->>'orderId' = $3)
      LIMIT 1
    `, [logId, eventType, String(paymentId)]);
    if (alreadyProcessed) {
      await query(`
        UPDATE payment_webhook_logs SET error_message = 'Already processed (idempotent)', processed = TRUE WHERE id = $1
      `, [logId]);
      logger.info('webhook_idempotent_skip', { logId, paymentId, eventType });
      return res.json({ success: true, message: 'Already processed' });
    }

    const order = await queryOne<any>(`
      SELECT * FROM card_orders WHERE provider_payment_id = $1
    `, [paymentId]);

    if (!order) {
      await query(`
        UPDATE payment_webhook_logs SET error_message = 'Order not found', processed = TRUE WHERE id = $1
      `, [logId]);
      return res.status(404).json({ success: false, error: 'Order not found' });
    }
    logger.info('webhook_order_found', { logId, orderId: order.id, paymentId, eventType });

    if (order.status === 'COMPLETED') {
      await query(`
        UPDATE payment_webhook_logs SET error_message = 'Order already completed (idempotent)', processed = TRUE WHERE id = $1
      `, [logId]);
      return res.json({ success: true, message: 'Already processed' });
    }

    const event = payload.event;
    const status = payload.status;
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

          // Map internal product names to display names
          let displayDescription = order.merchant_name;
          let displayMerchant = order.merchant_name;

          // Helper to generate unique realistic shop names
          const generateUniqueShopName = () => {
            const prefixes = ['Urban', 'Nova', 'Green', 'Blue', 'Star', 'Swift', 'Prime', 'Elite', 'Global', 'Tech', 'Alpha', 'Zenith', 'Rapid', 'Bright', 'Metro'];
            const industries = ['Retail', 'Tech', 'Studio', 'Systems', 'Solutions', 'Mart', 'Boutique', 'Logistics', 'Enterprises', 'Group', 'Hub', 'Labs', 'Digital', 'Concepts', 'Ventures'];

            const random = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];
            const uniqueId = Math.floor(100 + Math.random() * 900); // 3 digit random number

            return `${random(prefixes)} ${random(industries)} ${uniqueId}`;
          };

          // Genericize internal provider product names
          if (
            displayMerchant.toLowerCase().includes('fluz') ||
            displayMerchant.toLowerCase().includes('1800')
          ) {
            if (order.currency === 'USD') {
              // Generate a UNIQUE shop name for every transaction
              displayMerchant = generateUniqueShopName();
              displayDescription = 'Merchant Payment - #' + transactionId.substring(0, 8).toUpperCase();
            } else {
              displayMerchant = 'Global Services ' + Math.floor(Math.random() * 1000);
            }
          }

          // Generate a clean transaction ID format
          const merchantDisplayName = displayMerchant; // Use the generated unique name directly

          await client.query(`
            UPDATE transactions 
            SET merchant_display_name = $1, merchant_name = $2, description = $3 
            WHERE id = $4
          `, [merchantDisplayName, displayMerchant, displayDescription, transactionId]);

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
          `, [logId]);
        });

        await createAuditLog({
          userId: creditUserId,
          action: 'CARD_PAYMENT_COMPLETED',
          entityType: 'card_order',
          entityId: order.id,
          newValues: { amount: order.amount_cents, currency: order.currency },
        });

        logger.info('webhook_completed', { orderId: order.id, paymentId, eventType, amountCents: order.amount_cents, currency: order.currency });
      } catch (error: any) {
        await query(`
          UPDATE payment_webhook_logs SET error_message = $1, processed = TRUE WHERE id = $2
        `, [error.message, logId]);

        if (error.message?.includes('duplicate key')) {
          return res.json({ success: true, message: 'Already processed (idempotent)' });
        }
        throw error;
      }
    } else if (event === 'payment.failed' || status === 'failed') {
      await query(`UPDATE card_orders SET status = 'FAILED', updated_at = NOW() WHERE id = $1`, [order.id]);
      await query(`UPDATE payment_webhook_logs SET processed = TRUE WHERE id = $1`, [logId]);
      logger.info('webhook_failed', { orderId: order.id, paymentId, eventType });
      await createAuditLog({
        userId: order.user_id,
        action: 'CARD_PAYMENT_FAILED',
        entityType: 'card_order',
        entityId: order.id,
      });
    } else if (event === 'payment.expired' || status === 'expired') {
      await query(`UPDATE card_orders SET status = 'EXPIRED', updated_at = NOW() WHERE id = $1`, [order.id]);
      await query(`UPDATE payment_webhook_logs SET processed = TRUE WHERE id = $1`, [logId]);
      logger.info('webhook_expired', { orderId: order.id, paymentId, eventType });
    } else {
      await query(`
        UPDATE payment_webhook_logs SET error_message = $1, processed = TRUE WHERE id = $2
      `, [`Unhandled event: ${event ?? 'null'} status: ${status ?? 'null'}`, logId]);
      logger.info('webhook_unhandled', { logId, event, status, paymentId, eventType });
    }

    res.json({ success: true });
  })
);

const MAX_PAGE_SIZE = 100;
const safeLimit = (v: unknown) => Math.min(MAX_PAGE_SIZE, Math.max(1, Number(v) || 50));
const safeOffset = (v: unknown) => Math.max(0, Math.min(10000, Number(v) || 0));

adminRouter.get('/orders',
  authenticate,
  requireSuperAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { limit = 50, offset = 0, status, userId } = req.query;
    const limitNum = safeLimit(limit);
    const offsetNum = safeOffset(offset);

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
    `, [...params, limitNum, offsetNum]);

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
        limit: limitNum,
        offset: offsetNum,
      }
    });
  })
);

adminRouter.get('/webhook-logs',
  authenticate,
  requireSuperAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { limit = 50, offset = 0, processed } = req.query;
    const limitNum = safeLimit(limit);
    const offsetNum = safeOffset(offset);

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
    `, [...params, limitNum, offsetNum]);

    const countResult = await queryOne<{ count: string }>(`
      SELECT COUNT(*) as count FROM payment_webhook_logs ${whereClause}
    `, params);

    res.json({
      success: true,
      data: {
        logs,
        total: parseInt(countResult?.count || '0'),
        limit: limitNum,
        offset: offsetNum,
      }
    });
  })
);

adminRouter.post('/webhook-logs/:id/replay',
  authenticate,
  requireSuperAdmin,
  sensitiveOpLimiter,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const logId = req.params.id as string;
    const log = await queryOne<{ id: string; payload: string | object; event_type: string }>(`
      SELECT id, payload, event_type FROM payment_webhook_logs WHERE id = $1
    `, [logId]);
    if (!log) {
      throw new AppError('Webhook log not found', 404, 'NOT_FOUND');
    }
    const payload = typeof log.payload === 'string' ? JSON.parse(log.payload) : log.payload;
    const paymentId = payload.paymentId ?? payload.id ?? payload.orderId;
    if (!paymentId) {
      throw new AppError('Payload missing paymentId', 400, 'VALIDATION_ERROR');
    }
    const order = await queryOne<any>(`SELECT * FROM card_orders WHERE provider_payment_id = $1`, [paymentId]);
    if (!order) {
      throw new AppError('Order not found for this webhook', 404, 'ORDER_NOT_FOUND');
    }
    if (order.status === 'COMPLETED') {
      return res.json({ success: true, message: 'Already processed (order already COMPLETED)' });
    }
    const event = payload.event;
    const status = payload.status;
    if (event !== 'payment.completed' && status !== 'completed') {
      return res.json({ success: true, message: 'Replay only supports payment.completed; event was not completed' });
    }
    const creditUserId = order.target_user_id || order.user_id;
    await transaction(async (client) => {
      const txResult = await client.query(`
        INSERT INTO transactions (user_id, idempotency_key, type, status, amount_cents, currency, description, merchant_name, merchant_display_name, metadata)
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
        JSON.stringify({ paymentId, orderId: order.id, createdBy: order.created_by_user_id, replayed: true }),
      ]);
      const transactionId = txResult.rows[0].id;
      const merchantDisplayName = generateMerchantDisplayName(order.merchant_name || 'Card Deposit', transactionId);
      await client.query(`UPDATE transactions SET merchant_display_name = $1 WHERE id = $2`, [merchantDisplayName, transactionId]);
      await client.query(`
        INSERT INTO wallets (user_id, currency, balance_cents)
        VALUES ($1, $2, $3)
        ON CONFLICT (user_id, currency) DO UPDATE SET balance_cents = wallets.balance_cents + $3, updated_at = NOW()
      `, [creditUserId, order.currency, order.amount_cents]);
      const usdtAmountCents = Math.round(order.amount_cents / USDT_RATE);
      await client.query(`
        INSERT INTO wallets (user_id, currency, balance_cents, usdt_balance_cents)
        VALUES ($1, 'USD', 0, $2)
        ON CONFLICT (user_id, currency) DO UPDATE SET usdt_balance_cents = COALESCE(wallets.usdt_balance_cents, 0) + $2, updated_at = NOW()
      `, [creditUserId, usdtAmountCents]);
      await client.query(`
        INSERT INTO crypto_ledger_entries (user_id, source_order_id, source_transaction_id, crypto_type, amount_cents, exchange_rate, usd_equivalent_cents, description)
        VALUES ($1, $2, $3, 'USDT', $4, $5, $6, $7)
        ON CONFLICT (source_order_id, user_id) DO NOTHING
      `, [creditUserId, order.id, transactionId, usdtAmountCents, USDT_RATE, order.amount_cents, 'Auto USDT credit from card deposit (replay)']);
      await client.query(`UPDATE card_orders SET status = 'COMPLETED', transaction_id = $1, updated_at = NOW() WHERE id = $2`, [transactionId, order.id]);
      await client.query(`UPDATE payment_webhook_logs SET processed = TRUE, error_message = NULL WHERE id = $1`, [logId]);
    });
    await createAuditLog({
      userId: req.user!.id,
      action: 'WEBHOOK_LOG_REPLAY',
      entityType: 'payment_webhook_log',
      entityId: logId,
      newValues: { orderId: order.id, paymentId },
    });
    logger.info('Webhook log replayed', { logId, orderId: order.id, paymentId });
    res.json({ success: true, message: 'Replay completed', data: { orderId: order.id } });
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
    const limitNum = safeLimit(limit);
    const offsetNum = safeOffset(offset);

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
    `, [...params, limitNum, offsetNum]);

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
        limit: limitNum,
        offset: offsetNum,
      }
    });
  })
);

adminRouter.get('/provider-auth-status',
  authenticate,
  requireSuperAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const validation = validateFluzAuthHeaderFormat();
    res.json({
      success: true,
      data: {
        configured: isFluzConfigured(),
        authHeaderFormat: validation.format,
        baseUrl: getFluzBaseUrl() ? 'configured' : 'missing',
      },
    });
  })
);

adminRouter.get('/provider-live-ping',
  authenticate,
  requireSuperAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!isFluzConfigured()) {
      res.json({
        success: false,
        error: { code: 'PROVIDER_NOT_CONFIGURED', message: 'Payment provider not configured.' },
      });
      return;
    }
    detectFluzEnvironmentMismatch();
    const result = await testFluzConnection();
    if (result.success) {
      res.json({ success: true, data: { reachable: true } });
    } else {
      res.json({
        success: false,
        error: { code: 'PROVIDER_AUTH_FAILED', message: 'Payment service unavailable.' },
      });
    }
  })
);

export { checkoutRouter as cardCheckoutRouter, webhookRouter as paymentWebhookRouter, adminRouter as paymentAdminRouter };
