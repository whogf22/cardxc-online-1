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
import {
  createCheckoutSession,
  getCheckoutSession,
  constructWebhookEvent,
  getStripePublishableKey,
  isStripeConfigured,
} from '../services/stripeService';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../middleware/logger';
import crypto from 'crypto';
import {
  isStablecoinFulfillmentEnabled,
  isKycRequiredForCardCheckout,
  isEmailVerificationRequiredForCardCheckout,
  DEPOSIT_MERCHANT_DISPLAY_NAME,
  depositDescription,
} from '../services/fulfillmentPolicy';

const checkoutRouter = Router();
const webhookRouter = Router();
const adminRouter = Router();

const PROVIDER_WEBHOOK_SECRET = process.env.FLUZ_WEBHOOK_SECRET;
const USDT_RATE = parseFloat(process.env.USDT_RATE || '1.0');

/**
 * Credit stablecoin (USDT) for a completed card-funded deposit — ONLY when
 * stablecoin fulfillment is explicitly enabled (fail-closed by default).
 * Centralized so every completion path (provider webhook, Stripe webhook, admin
 * replay) makes the identical gated decision instead of duplicating the logic.
 */
async function creditStablecoinIfEnabled(
  client: { query: (text: string, params?: any[]) => Promise<any> },
  creditUserId: string,
  order: { id: string; amount_cents: number },
  transactionId: string,
  context: string,
): Promise<void> {
  if (!isStablecoinFulfillmentEnabled()) {
    logger.info('stablecoin_fulfillment_skipped', { orderId: order.id, context });
    return;
  }
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
  `, [creditUserId, order.id, transactionId, usdtAmountCents, USDT_RATE, order.amount_cents, `USDT fulfillment for card deposit (${context})`]);
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
    if (isEmailVerificationRequiredForCardCheckout() && !depositor.email_verified) {
      throw new AppError('Please verify your email before adding funds with a card.', 403, 'EMAIL_VERIFICATION_REQUIRED');
    }
    if (isKycRequiredForCardCheckout() && (depositor.kyc_status || '').toLowerCase() !== 'approved') {
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

    // Fail-closed: a provider webhook secret is REQUIRED. Without it we cannot
    // authenticate the sender, so processing an unsigned/forged event could
    // credit arbitrary wallets. Reject before doing any work (mirrors Stripe).
    if (!PROVIDER_WEBHOOK_SECRET) {
      logger.error('provider_webhook_no_secret_configured', {
        message: 'FLUZ_WEBHOOK_SECRET is required; rejecting webhook request',
      });
      return res.status(503).json({ success: false, error: 'Webhook secret not configured' });
    }

    // ---- AUTHENTICATE FIRST -------------------------------------------------
    // Nothing attacker-controlled is persisted, and no existence oracle is
    // answered, until the HMAC verifies. Previously the payload was INSERTed
    // into payment_webhook_logs and the idempotency lookup replied
    // "Already processed" before any signature check, which let an
    // unauthenticated caller write into a trusted table and probe whether a
    // given paymentId had been handled.
    if (!signature) {
      // Minimal sanitised metadata only: no payload, no paymentId, no secret.
      // The message distinguishes missing from invalid, which leaks nothing —
      // the caller already knows whether it sent a signature header.
      logger.warn('webhook_rejected_missing_signature');
      return res.status(401).json({ success: false, error: 'Missing signature' });
    }

    // Malformed body: an object is required to carry a real event.
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
      logger.warn('webhook_rejected_malformed_body');
      return res.status(400).json({ success: false, error: 'Malformed body' });
    }

    const expectedSignature = crypto
      .createHmac('sha256', PROVIDER_WEBHOOK_SECRET)
      .update(payloadForSignature)
      .digest('hex');
    // Constant-time comparison to avoid leaking the expected HMAC via timing.
    // Length-guard first: timingSafeEqual throws on unequal-length buffers,
    // and a length mismatch is itself a definitive rejection.
    const sigBuf = Buffer.from(signature, 'utf8');
    const expBuf = Buffer.from(expectedSignature, 'utf8');
    const signatureValid =
      sigBuf.length === expBuf.length && crypto.timingSafeEqual(sigBuf, expBuf);
    if (!signatureValid) {
      // Same status and body as the missing-signature case: an unauthenticated
      // caller learns nothing about the payload or about what we already hold.
      logger.warn('webhook_rejected_invalid_signature');
      return res.status(401).json({ success: false, error: 'Invalid signature' });
    }
    // ---- AUTHENTICATED FROM HERE -------------------------------------------

    // Idempotency (authenticated callers only, so this is no longer an oracle):
    // if we already processed this paymentId + event successfully, return 200
    // without inserting a log (reduce DB churn).
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

    // Only now is the payload trusted enough to persist.
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

    logger.info('webhook_received_authenticated', { logId, eventType, paymentId });

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

          // Honest, non-randomized labeling: this is a card-funded wallet
          // deposit, not a merchant purchase. We never synthesize fake shop
          // names to disguise the real purpose.
          await client.query(`
            UPDATE transactions
            SET merchant_display_name = $1, description = $2
            WHERE id = $3
          `, [DEPOSIT_MERCHANT_DISPLAY_NAME, depositDescription(), transactionId]);

          await client.query(`
            INSERT INTO wallets (user_id, currency, balance_cents)
            VALUES ($1, $2, $3)
            ON CONFLICT (user_id, currency) 
            DO UPDATE SET balance_cents = wallets.balance_cents + $3, updated_at = NOW()
          `, [creditUserId, order.currency, order.amount_cents]);

          // Stablecoin (USDT) fulfillment is fail-closed: skipped unless
          // explicitly enabled. A card deposit credits only the fiat balance.
          await creditStablecoinIfEnabled(client, creditUserId, order, transactionId, 'provider_webhook');

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
      await client.query(`UPDATE transactions SET merchant_display_name = $1, description = $2 WHERE id = $3`, [DEPOSIT_MERCHANT_DISPLAY_NAME, depositDescription(), transactionId]);
      await client.query(`
        INSERT INTO wallets (user_id, currency, balance_cents)
        VALUES ($1, $2, $3)
        ON CONFLICT (user_id, currency) DO UPDATE SET balance_cents = wallets.balance_cents + $3, updated_at = NOW()
      `, [creditUserId, order.currency, order.amount_cents]);
      // Fail-closed: stablecoin credit only when explicitly enabled.
      await creditStablecoinIfEnabled(client, creditUserId, order, transactionId, 'admin_replay');
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

// --- Stripe Checkout Routes ---

checkoutRouter.get('/stripe-config', asyncHandler(async (_req: Request, res: Response) => {
  const publishableKey = getStripePublishableKey();
  res.json({ success: true, data: { publishableKey: publishableKey || null } });
}));

checkoutRouter.post('/stripe-session',
  authenticate,
  sensitiveOpLimiter,
  body('amount').isFloat({ min: 100, max: 2500 }).withMessage('Amount must be between 100 and 2500'),
  body('currency').isIn(['USD', 'EUR', 'GBP']).withMessage('Currency must be USD, EUR, or GBP'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const firstError = errors.array()[0];
      throw new AppError(firstError.msg || 'Validation failed', 400, 'VALIDATION_ERROR');
    }

    if (!isStripeConfigured()) {
      throw new AppError('Stripe is not configured', 503, 'STRIPE_NOT_CONFIGURED');
    }

    const { amount, currency } = req.body;
    const userId = req.user!.id;

    const depositor = await queryOne<{ email_verified: boolean; kyc_status: string; email: string }>(`
      SELECT email_verified, kyc_status, email FROM users WHERE id = $1
    `, [userId]);
    if (!depositor) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }
    if (isEmailVerificationRequiredForCardCheckout() && !depositor.email_verified) {
      throw new AppError('Please verify your email before adding funds with a card.', 403, 'EMAIL_VERIFICATION_REQUIRED');
    }
    if (isKycRequiredForCardCheckout() && (depositor.kyc_status || '').toLowerCase() !== 'approved') {
      throw new AppError('Identity verification (KYC) is required before adding funds with a card.', 403, 'KYC_REQUIRED');
    }

    const roundedAmount = Math.round(Number(amount) * 100) / 100;
    if (isNaN(roundedAmount) || roundedAmount < 100 || roundedAmount > 2500) {
      throw new AppError('Amount must be between 100 and 2500', 400, 'VALIDATION_ERROR');
    }

    const amountCents = Math.round(roundedAmount * 100);

    const orderResult = await queryOne<{ id: string }>(`
      INSERT INTO card_orders (user_id, created_by_user_id, target_user_id, amount_cents, currency, merchant_name, status)
      VALUES ($1, $1, $1, $2, $3, 'Stripe Checkout', 'PENDING')
      RETURNING id
    `, [userId, amountCents, currency]);

    if (!orderResult) {
      throw new AppError('Failed to create order', 500, 'ORDER_CREATE_FAILED');
    }

    const orderId = orderResult.id;
    const appUrl = process.env.APP_URL || '';
    const returnUrl = appUrl ? `${appUrl.replace(/\/$/, '')}/wallet` : '/wallet';

    try {
      const { clientSecret, sessionId } = await createCheckoutSession(
        amountCents,
        currency,
        orderId,
        depositor.email,
        returnUrl,
        'CardXC Deposit'
      );

      await query(`
        UPDATE card_orders SET provider_payment_id = $1, updated_at = NOW() WHERE id = $2
      `, [sessionId, orderId]);

      await createAuditLog({
        userId,
        action: 'STRIPE_CHECKOUT_CREATED',
        entityType: 'card_order',
        entityId: orderId,
        newValues: { amount: amountCents, currency, sessionId },
      });

      logger.info('stripe_checkout_session_created', { orderId, sessionId, amountCents, currency });

      res.status(201).json({
        success: true,
        data: { clientSecret, sessionId },
      });
    } catch (error: any) {
      await query('UPDATE card_orders SET status = $1, updated_at = NOW() WHERE id = $2', ['FAILED', orderId]);
      logger.error('stripe_checkout_session_failed', { orderId, error: error.message });
      throw new AppError('Failed to create Stripe checkout session. Please try again later.', 503, 'STRIPE_SESSION_FAILED');
    }
  })
);

checkoutRouter.get('/stripe-session/:sessionId/status',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const sessionId = req.params.sessionId as string;

    if (!isStripeConfigured()) {
      throw new AppError('Stripe is not configured', 503, 'STRIPE_NOT_CONFIGURED');
    }

    // Ownership check (prevents IDOR): the caller may only read the status of a
    // checkout session that belongs to one of their own orders. Return 404
    // (not 403) so we don't reveal whether an arbitrary session id exists.
    const order = await queryOne<{ user_id: string; target_user_id: string | null; created_by_user_id: string | null }>(
      `SELECT user_id, target_user_id, created_by_user_id FROM card_orders WHERE provider_payment_id = $1`,
      [sessionId]
    );
    const uid = req.user!.id;
    const owns = !!order && (order.user_id === uid || order.target_user_id === uid || order.created_by_user_id === uid);
    if (!owns && req.user!.role !== 'SUPER_ADMIN') {
      throw new AppError('Checkout session not found', 404, 'NOT_FOUND');
    }

    try {
      const session = await getCheckoutSession(sessionId);
      res.json({
        success: true,
        data: {
          status: session.status,
          paymentStatus: session.payment_status,
        },
      });
    } catch (error: any) {
      logger.error('stripe_session_status_failed', { sessionId, error: error.message });
      throw new AppError('Failed to retrieve checkout session status', 500, 'STRIPE_STATUS_FAILED');
    }
  })
);

const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

webhookRouter.post('/stripe',
  asyncHandler(async (req: Request, res: Response) => {
    const signature = req.headers['stripe-signature'] as string;
    const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;

    // STRIPE_WEBHOOK_SECRET is REQUIRED in all environments. Unsigned webhook
    // events would allow anyone to credit arbitrary user wallets, so there is
    // no safe "skip in dev" path.
    if (!STRIPE_WEBHOOK_SECRET) {
      logger.error('stripe_webhook_no_secret_configured', {
        message: 'STRIPE_WEBHOOK_SECRET is required; rejecting webhook request',
      });
      return res.status(503).json({ error: 'Webhook secret not configured' });
    }

    if (!signature) {
      logger.warn('stripe_webhook_missing_signature');
      return res.status(401).json({ error: 'Missing stripe-signature header' });
    }
    if (!rawBody) {
      logger.warn('stripe_webhook_missing_raw_body');
      return res.status(400).json({ error: 'Missing raw body for signature verification' });
    }

    let event: any;
    try {
      event = constructWebhookEvent(rawBody, signature, STRIPE_WEBHOOK_SECRET);
    } catch (err: any) {
      logger.error('stripe_webhook_signature_verification_failed', { error: err.message });
      return res.status(400).json({ error: 'Webhook signature verification failed' });
    }

    const eventType = event.type;
    logger.info('stripe_webhook_received', { eventType, eventId: event.id });

    if (eventType === 'checkout.session.completed') {
      const session = event.data.object;
      const orderId = session.metadata?.orderId;

      if (!orderId) {
        logger.warn('stripe_webhook_missing_order_id', { sessionId: session.id });
        return res.json({ received: true });
      }

      const order = await queryOne<any>(`SELECT * FROM card_orders WHERE id = $1`, [orderId]);

      if (!order) {
        logger.warn('stripe_webhook_order_not_found', { orderId, sessionId: session.id });
        return res.json({ received: true });
      }

      if (order.status === 'COMPLETED') {
        logger.info('stripe_webhook_order_already_completed', { orderId });
        return res.json({ received: true });
      }

      // Fulfillment verification (fail-closed): only credit when Stripe reports
      // the funds were actually captured AND the paid amount + currency match
      // the order we created. Guards against crediting on unpaid/async-pending
      // sessions or on any amount/currency tampering.
      const paymentStatus = session.payment_status;
      const paidAmount = typeof session.amount_total === 'number' ? session.amount_total : null;
      const paidCurrency = typeof session.currency === 'string' ? session.currency.toLowerCase() : null;
      const expectedCurrency = String(order.currency || '').toLowerCase();

      if (paymentStatus !== 'paid') {
        logger.warn('stripe_webhook_not_paid', { orderId, sessionId: session.id, paymentStatus });
        return res.json({ received: true });
      }
      if (paidAmount !== order.amount_cents || paidCurrency !== expectedCurrency) {
        logger.error('stripe_webhook_amount_currency_mismatch', {
          orderId,
          sessionId: session.id,
          expectedAmount: order.amount_cents,
          paidAmount,
          expectedCurrency,
          paidCurrency,
        });
        await query(`UPDATE card_orders SET status = 'FAILED', updated_at = NOW() WHERE id = $1 AND status = 'PENDING'`, [orderId]);
        await createAuditLog({
          userId: order.user_id,
          action: 'CARD_PAYMENT_MISMATCH',
          entityType: 'card_order',
          entityId: order.id,
          newValues: { expectedAmount: order.amount_cents, paidAmount, expectedCurrency, paidCurrency },
        });
        return res.json({ received: true });
      }

      const creditUserId = order.target_user_id || order.user_id;

      try {
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
            `stripe_${session.id}`,
            order.amount_cents,
            order.currency,
            depositDescription(),
            'Stripe Checkout',
            DEPOSIT_MERCHANT_DISPLAY_NAME,
            JSON.stringify({ stripeSessionId: session.id, orderId: order.id, createdBy: order.created_by_user_id }),
          ]);

          const transactionId = txResult.rows[0].id;

          await client.query(`
            INSERT INTO wallets (user_id, currency, balance_cents)
            VALUES ($1, $2, $3)
            ON CONFLICT (user_id, currency)
            DO UPDATE SET balance_cents = wallets.balance_cents + $3, updated_at = NOW()
          `, [creditUserId, order.currency, order.amount_cents]);

          // Stablecoin (USDT) fulfillment is fail-closed: skipped unless
          // explicitly enabled. Stripe card funds credit only the fiat balance.
          await creditStablecoinIfEnabled(client, creditUserId, order, transactionId, 'stripe_webhook');

          await client.query(`
            UPDATE card_orders SET status = 'COMPLETED', transaction_id = $1, updated_at = NOW() WHERE id = $2
          `, [transactionId, order.id]);
        });

        await createAuditLog({
          userId: creditUserId,
          action: 'CARD_PAYMENT_COMPLETED',
          entityType: 'card_order',
          entityId: order.id,
          newValues: { amount: order.amount_cents, currency: order.currency, source: 'stripe' },
        });

        logger.info('stripe_webhook_order_completed', { orderId, sessionId: session.id, amountCents: order.amount_cents, currency: order.currency });
      } catch (error: any) {
        logger.error('stripe_webhook_processing_error', { orderId, error: error.message });
        if (error.message?.includes('duplicate key')) {
          return res.json({ received: true });
        }
        throw error;
      }
    } else if (eventType === 'checkout.session.expired') {
      const session = event.data.object;
      const orderId = session.metadata?.orderId;

      if (orderId) {
        await query(`UPDATE card_orders SET status = 'EXPIRED', updated_at = NOW() WHERE id = $1 AND status = 'PENDING'`, [orderId]);
        logger.info('stripe_webhook_order_expired', { orderId, sessionId: session.id });
      }
    } else {
      logger.info('stripe_webhook_unhandled_event', { eventType });
    }

    res.json({ received: true });
  })
);

export { checkoutRouter as cardCheckoutRouter, webhookRouter as paymentWebhookRouter, adminRouter as paymentAdminRouter };
