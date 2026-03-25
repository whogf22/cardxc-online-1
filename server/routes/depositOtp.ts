/**
 * Card Deposit OTP Verification Route
 * Flow:
 *   1. POST /api/deposit-otp/initiate  → Creates Stripe session + sends OTP email
 *   2. POST /api/deposit-otp/verify    → Verifies OTP + credits wallet
 *   3. POST /api/deposit-otp/resend    → Resends OTP for existing pending deposit
 */
import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { query, queryOne, transaction } from '../db/pool';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { sensitiveOpLimiter } from '../middleware/rateLimit';
import { createAuditLog } from '../services/auditService';
import { sendDepositOtpEmail, sendDepositSuccessEmail } from '../services/emailService';
import {
  createCheckoutSession,
  getCheckoutSession,
  getStripePublishableKey,
  isStripeConfigured,
} from '../services/stripeService';
import { logger } from '../middleware/logger';
import crypto from 'crypto';

const router = Router();
router.use(authenticate);

const OTP_EXPIRY_MINUTES = 10;
const MAX_OTP_ATTEMPTS = 5;
const USDT_RATE = parseFloat(process.env.USDT_RATE || '1.0');

function generateOtp(): string {
  return crypto.randomInt(100000, 999999).toString();
}

// ─── 1. INITIATE DEPOSIT: Create Stripe session + send OTP ───────────────────
router.post(
  '/initiate',
  sensitiveOpLimiter,
  body('amount').isFloat({ min: 1, max: 2500 }).withMessage('Amount must be between $1 and $2500'),
  body('currency').isIn(['USD', 'EUR', 'GBP']).withMessage('Currency must be USD, EUR, or GBP'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppError(errors.array()[0].msg, 400, 'VALIDATION_ERROR');
    }

    if (!isStripeConfigured()) {
      throw new AppError('Payment service not configured', 503, 'STRIPE_NOT_CONFIGURED');
    }

    const { amount, currency } = req.body;
    const userId = req.user!.id;

    // Get user info
    const user = await queryOne<{ email: string; full_name: string; email_verified: boolean }>(
      'SELECT email, full_name, email_verified FROM users WHERE id = $1',
      [userId]
    );
    if (!user) throw new AppError('User not found', 404, 'USER_NOT_FOUND');

    const amountCents = Math.round(Number(amount) * 100);

    // Create card order
    const orderResult = await queryOne<{ id: string }>(
      `INSERT INTO card_orders (user_id, created_by_user_id, target_user_id, amount_cents, currency, merchant_name, status)
       VALUES ($1, $1, $1, $2, $3, 'Card Deposit', 'PENDING')
       RETURNING id`,
      [userId, amountCents, currency]
    );
    if (!orderResult) throw new AppError('Failed to create order', 500, 'ORDER_CREATE_FAILED');
    const orderId = orderResult.id;

    // Create Stripe checkout session
    const appUrl = process.env.APP_URL || 'https://cardxc.online';
    const returnUrl = `${appUrl}/wallet?deposit=return&session_id={CHECKOUT_SESSION_ID}`;
    let stripeSessionId: string;
    let stripeClientSecret: string;
    try {
      const { clientSecret, sessionId } = await createCheckoutSession(
        amountCents,
        currency,
        orderId,
        user.email,
        returnUrl
      );
      stripeSessionId = sessionId;
      stripeClientSecret = clientSecret;
      await query(
        'UPDATE card_orders SET provider_payment_id = $1, updated_at = NOW() WHERE id = $2',
        [sessionId, orderId]
      );
    } catch (err: any) {
      await query('UPDATE card_orders SET status = $1 WHERE id = $2', ['FAILED', orderId]);
      throw new AppError('Failed to create payment session', 503, 'STRIPE_SESSION_FAILED');
    }

    // Generate OTP and store it
    const otpCode = generateOtp();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    // Invalidate any previous pending OTPs for this user
    await query(
      `UPDATE deposit_otps SET verified = TRUE WHERE user_id = $1 AND verified = FALSE`,
      [userId]
    );

    await query(
      `INSERT INTO deposit_otps (user_id, order_id, otp_code, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [userId, orderId, otpCode, expiresAt]
    );

    // Send OTP email
    const emailSent = await sendDepositOtpEmail(
      user.email,
      user.full_name,
      otpCode,
      Number(amount),
      currency
    );

    logger.info('deposit_otp_initiated', {
      userId,
      orderId,
      amountCents,
      currency,
      emailSent,
    });

    await createAuditLog({
      userId,
      action: 'DEPOSIT_OTP_INITIATED',
      entityType: 'card_order',
      entityId: orderId,
      newValues: { amount: amountCents, currency },
    });

    res.status(201).json({
      success: true,
      data: {
        orderId,
        sessionId: stripeSessionId,
        clientSecret: stripeClientSecret,
        email: user.email.replace(/(.{2}).+(@.+)/, '$1***$2'), // masked email
        expiresAt: expiresAt.toISOString(),
        message: `Verification code sent to your registered email.`,
      },
    });
  })
);

// ─── 2. VERIFY OTP + CREDIT WALLET ───────────────────────────────────────────
router.post(
  '/verify',
  sensitiveOpLimiter,
  body('orderId').isUUID().withMessage('Valid order ID required'),
  body('otpCode').isLength({ min: 6, max: 6 }).isNumeric().withMessage('OTP must be 6 digits'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppError(errors.array()[0].msg, 400, 'VALIDATION_ERROR');
    }

    const { orderId, otpCode } = req.body;
    const userId = req.user!.id;

    // Get the order
    const order = await queryOne<any>(
      `SELECT * FROM card_orders WHERE id = $1 AND user_id = $2`,
      [orderId, userId]
    );
    if (!order) throw new AppError('Order not found', 404, 'ORDER_NOT_FOUND');
    if (order.status === 'COMPLETED') {
      throw new AppError('This deposit has already been completed', 400, 'ALREADY_COMPLETED');
    }

    // Get OTP record
    const otpRecord = await queryOne<any>(
      `SELECT * FROM deposit_otps
       WHERE order_id = $1 AND user_id = $2 AND verified = FALSE
       ORDER BY created_at DESC LIMIT 1`,
      [orderId, userId]
    );

    if (!otpRecord) {
      throw new AppError('No pending verification found. Please initiate a new deposit.', 400, 'OTP_NOT_FOUND');
    }

    // Check expiry
    if (new Date(otpRecord.expires_at) < new Date()) {
      throw new AppError('Verification code has expired. Please request a new deposit.', 400, 'OTP_EXPIRED');
    }

    // Check attempts
    if (otpRecord.attempts >= MAX_OTP_ATTEMPTS) {
      throw new AppError('Too many failed attempts. Please initiate a new deposit.', 429, 'OTP_MAX_ATTEMPTS');
    }

    // Verify OTP
    if (otpRecord.otp_code !== otpCode) {
      await query(
        'UPDATE deposit_otps SET attempts = attempts + 1 WHERE id = $1',
        [otpRecord.id]
      );
      const remaining = MAX_OTP_ATTEMPTS - (otpRecord.attempts + 1);
      throw new AppError(
        `Invalid verification code. ${remaining} attempt(s) remaining.`,
        400,
        'OTP_INVALID'
      );
    }

    // Check Stripe payment status
    if (!isStripeConfigured()) {
      throw new AppError('Payment service not configured', 503, 'STRIPE_NOT_CONFIGURED');
    }

    let stripeSession: any = null;
    if (order.provider_payment_id) {
      try {
        stripeSession = await getCheckoutSession(order.provider_payment_id);
      } catch (err: any) {
        logger.warn('deposit_otp_stripe_check_failed', { orderId, error: err.message });
      }
    }

    // Allow completion if Stripe payment is confirmed OR if in test/demo mode
    const stripeConfirmed = stripeSession?.payment_status === 'paid' || stripeSession?.status === 'complete';
    const isTestMode = process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_');

    if (!stripeConfirmed && !isTestMode) {
      throw new AppError(
        'Payment not yet confirmed. Please complete the payment first.',
        402,
        'PAYMENT_NOT_CONFIRMED'
      );
    }

    // Get user info for email
    const user = await queryOne<{ email: string; full_name: string }>(
      'SELECT email, full_name FROM users WHERE id = $1',
      [userId]
    );

    // Mark OTP as verified
    await query('UPDATE deposit_otps SET verified = TRUE WHERE id = $1', [otpRecord.id]);

    // Credit wallet in a transaction
    let newBalance = 0;
    await transaction(async (client) => {
      // Check idempotency
      const existing = await client.query(
        `SELECT id FROM transactions WHERE idempotency_key = $1`,
        [`deposit_otp_${orderId}`]
      );
      if (existing.rows.length > 0) {
        // Already processed
        const walletRow = await client.query(
          `SELECT balance_cents FROM wallets WHERE user_id = $1 AND currency = $2`,
          [userId, order.currency]
        );
        newBalance = walletRow.rows[0]?.balance_cents / 100 || 0;
        return;
      }

      // Insert transaction
      const txResult = await client.query(
        `INSERT INTO transactions (user_id, idempotency_key, type, status, amount_cents, currency, description, metadata)
         VALUES ($1, $2, 'deposit', 'SUCCESS', $3, $4, $5, $6)
         RETURNING id`,
        [
          userId,
          `deposit_otp_${orderId}`,
          order.amount_cents,
          order.currency,
          'Card Deposit (OTP Verified)',
          JSON.stringify({ orderId, source: 'card_deposit_otp', stripeSessionId: order.provider_payment_id }),
        ]
      );
      const transactionId = txResult.rows[0].id;

      // Credit wallet
      const walletResult = await client.query(
        `INSERT INTO wallets (user_id, currency, balance_cents)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, currency)
         DO UPDATE SET balance_cents = wallets.balance_cents + $3, updated_at = NOW()
         RETURNING balance_cents`,
        [userId, order.currency, order.amount_cents]
      );
      newBalance = walletResult.rows[0].balance_cents / 100;

      // Also credit USDT balance
      const usdtAmountCents = Math.round(order.amount_cents / USDT_RATE);
      await client.query(
        `INSERT INTO wallets (user_id, currency, balance_cents, usdt_balance_cents)
         VALUES ($1, 'USD', 0, $2)
         ON CONFLICT (user_id, currency)
         DO UPDATE SET usdt_balance_cents = COALESCE(wallets.usdt_balance_cents, 0) + $2, updated_at = NOW()`,
        [userId, usdtAmountCents]
      );

      // Update order status
      await client.query(
        `UPDATE card_orders SET status = 'COMPLETED', transaction_id = $1, updated_at = NOW() WHERE id = $2`,
        [transactionId, orderId]
      );
    });

    // Send success email
    if (user) {
      await sendDepositSuccessEmail(
        user.email,
        user.full_name,
        order.amount_cents / 100,
        order.currency,
        newBalance
      );
    }

    await createAuditLog({
      userId,
      action: 'DEPOSIT_OTP_VERIFIED',
      entityType: 'card_order',
      entityId: orderId,
      newValues: { amount: order.amount_cents, currency: order.currency, newBalance },
    });

    logger.info('deposit_otp_verified_and_credited', {
      userId,
      orderId,
      amountCents: order.amount_cents,
      currency: order.currency,
      newBalance,
    });

    res.json({
      success: true,
      data: {
        message: 'Deposit verified and credited to your wallet!',
        amount: order.amount_cents / 100,
        currency: order.currency,
        newBalance,
      },
    });
  })
);

// ─── 3. RESEND OTP ────────────────────────────────────────────────────────────
router.post(
  '/resend',
  sensitiveOpLimiter,
  body('orderId').isUUID().withMessage('Valid order ID required'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppError(errors.array()[0].msg, 400, 'VALIDATION_ERROR');
    }

    const { orderId } = req.body;
    const userId = req.user!.id;

    const order = await queryOne<any>(
      `SELECT * FROM card_orders WHERE id = $1 AND user_id = $2 AND status = 'PENDING'`,
      [orderId, userId]
    );
    if (!order) throw new AppError('Pending order not found', 404, 'ORDER_NOT_FOUND');

    const user = await queryOne<{ email: string; full_name: string }>(
      'SELECT email, full_name FROM users WHERE id = $1',
      [userId]
    );
    if (!user) throw new AppError('User not found', 404, 'USER_NOT_FOUND');

    // Invalidate old OTPs
    await query(
      'UPDATE deposit_otps SET verified = TRUE WHERE user_id = $1 AND order_id = $2 AND verified = FALSE',
      [userId, orderId]
    );

    // Generate new OTP
    const otpCode = generateOtp();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    await query(
      `INSERT INTO deposit_otps (user_id, order_id, otp_code, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [userId, orderId, otpCode, expiresAt]
    );

    await sendDepositOtpEmail(
      user.email,
      user.full_name,
      otpCode,
      order.amount_cents / 100,
      order.currency
    );

    logger.info('deposit_otp_resent', { userId, orderId });

    res.json({
      success: true,
      data: {
        message: 'New verification code sent to your email.',
        expiresAt: expiresAt.toISOString(),
      },
    });
  })
);

export { router as depositOtpRouter };
