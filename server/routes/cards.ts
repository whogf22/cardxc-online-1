import { Router, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { query, queryOne, transaction } from '../db/pool';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { sensitiveOpLimiter } from '../middleware/rateLimit';
import { createAuditLog } from '../services/auditService';
import { logger } from '../middleware/logger';
import * as fluzApi from '../services/fluzApi';
import { v4 as uuidv4 } from 'uuid';

const router = Router();
router.use(authenticate);

// UUID validation helper
const validateUUID = param('id').isUUID().withMessage('Invalid ID format');

router.get('/', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cards = await query(`
    SELECT vc.id, vc.card_name, vc.last_four, vc.card_type, vc.balance_cents, 
           vc.spending_limit_cents, vc.status, vc.is_single_use, vc.created_at,
           vc.fluz_card_id,
           cc.frozen, cc.merchant_blocklist, cc.category_limits
    FROM virtual_cards vc
    LEFT JOIN card_controls cc ON cc.card_id = vc.id
    WHERE vc.user_id = $1
    ORDER BY vc.created_at DESC
  `, [req.user!.id]);

  const { fluz_card_id: _, ...rest } = cards[0] || {};
  res.json({ success: true, data: { cards: cards.map(c => {
    const { fluz_card_id, ...cardData } = c;
    return { ...cardData, hasProviderCard: !!fluz_card_id };
  }) } });
}));

router.get('/:id/reveal', validateUUID, sensitiveOpLimiter, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new AppError('Invalid ID format', 400, 'VALIDATION_ERROR');
  }

  const id = req.params.id as string;
  const card = await queryOne<any>(`
    SELECT id, fluz_card_id FROM virtual_cards WHERE id = $1 AND user_id = $2
  `, [id, req.user!.id]);

  if (!card) {
    throw new AppError('Card not found', 404, 'NOT_FOUND');
  }

    await createAuditLog({
    userId: req.user!.id,
    action: 'CARD_REVEALED',
    entityType: 'virtual_card',
    entityId: id,
  });

  // If card has a Fluz provider card, reveal from provider
  if (card.fluz_card_id && fluzApi.isConfigured()) {
    try {
      const revealed = await fluzApi.revealVirtualCard(card.fluz_card_id);
      return res.json({
        success: true,
        data: {
          cardNumber: revealed.cardNumber,
          expiryMMYY: revealed.expiryMMYY,
          cvv: revealed.cvv,
          cardHolderName: revealed.cardHolderName,
          billingAddress: revealed.billingAddress,
        }
      });
    } catch (err: any) {
      logger.warn('Provider card reveal failed', { error: err.message });
    }
  }

  // Local card: return card details from DB
  const localCard = await queryOne<any>(`
    SELECT vc.last_four, vc.card_type, u.full_name
    FROM virtual_cards vc
    JOIN users u ON u.id = vc.user_id
    WHERE vc.id = $1
  `, [id]);
  const now = new Date();
  const expYear = now.getFullYear() + 3;
  const expMonth = String(now.getMonth() + 1).padStart(2, '0');
  res.json({
    success: true,
    data: {
      cardNumber: `4111 1111 1111 ${localCard?.last_four || '0000'}`,
      expiryMMYY: `${expMonth}/${String(expYear).slice(-2)}`,
      cvv: '***',
      cardHolderName: localCard?.full_name || 'CARD HOLDER',
      billingAddress: null,
      isLocalCard: true,
    }
  });
}));

router.post('/',
  sensitiveOpLimiter,
  body('cardName').trim().notEmpty().isLength({ max: 50 }),
  body('cardType').optional().isIn(['VISA', 'MASTERCARD']),
  body('spendingLimit').optional().isFloat({ min: 1 }).withMessage('Spend limit must be at least $1'),
  body('spendLimitDuration').optional().isIn(['DAILY', 'WEEKLY', 'MONTHLY', 'ANNUAL', 'LIFETIME']),
  body('isSingleUse').optional().isBoolean(),
  body('currency').optional().isIn(['USD', 'EUR', 'GBP', 'NGN']),
  body('offerId').optional().isUUID().withMessage('Invalid offer ID'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppError(errors.array()[0].msg, 400, 'VALIDATION_ERROR');
    }

    const { cardName, cardType = 'VISA', spendingLimit, spendLimitDuration, isSingleUse = false, currency = 'USD', offerId } = req.body;
    const spendingLimitCents = spendingLimit ? Math.round(spendingLimit * 100) : null;

    let fluzCardId: string | null = null;
    let lastFour = Math.floor(1000 + Math.random() * 9000).toString();

    if (fluzApi.isConfigured()) {
      try {
        const fluzCard = await fluzApi.createVirtualCard({
          spendLimit: spendingLimit || 100,
          spendLimitDuration: spendLimitDuration || (isSingleUse ? 'LIFETIME' : 'MONTHLY'),
          cardNickname: cardName,
          primaryFundingSource: 'FLUZ_BALANCE',
          lockCardNextUse: isSingleUse,
          idempotencyKey: uuidv4(),
          offerId: offerId || undefined,
        });
        fluzCardId = fluzCard.virtualCardId;
        lastFour = fluzCard.virtualCardLast4 || lastFour;
        logger.info('Provider virtual card created for user', { userId: req.user!.id, providerCardId: fluzCardId, last4: lastFour });
      } catch (providerErr: any) {
        logger.warn('Provider card creation failed, creating local card only', { userId: req.user!.id, error: providerErr.message });
        // Fall through — create local card without provider
      }
    } else {
      logger.info('Card provider not configured, creating local virtual card', { userId: req.user!.id });
    }

    const cardId = await transaction(async (client) => {
      const cardResult = await client.query(`
        INSERT INTO virtual_cards (user_id, card_name, last_four, card_type, spending_limit_cents, is_single_use, currency, fluz_card_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id
      `, [req.user!.id, cardName, lastFour, cardType, spendingLimitCents, isSingleUse, currency, fluzCardId]);

      const cardId = cardResult.rows[0].id;

      await client.query(`
        INSERT INTO card_controls (card_id, frozen, merchant_blocklist, category_limits)
        VALUES ($1, FALSE, '[]', '{}')
      `, [cardId]);

      return cardId;
    });

    await createAuditLog({
      userId: req.user!.id,
      action: 'CARD_CREATED',
      entityType: 'virtual_card',
      entityId: cardId,
      newValues: { cardName, cardType, isSingleUse },
    });

    const card = await queryOne(`
      SELECT id, card_name, last_four, card_type, balance_cents, spending_limit_cents, status, is_single_use, created_at
      FROM virtual_cards WHERE id = $1
    `, [cardId]);

    res.status(201).json({ success: true, data: { card } });
  })
);

router.post('/:id/freeze', validateUUID, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new AppError('Invalid ID format', 400, 'VALIDATION_ERROR');
  }

  const id = req.params.id as string;

  const card = await queryOne<any>(`
    SELECT id, fluz_card_id FROM virtual_cards WHERE id = $1 AND user_id = $2
  `, [id, req.user!.id]);

  if (!card) {
    throw new AppError('Card not found', 404, 'NOT_FOUND');
  }

  if (card.fluz_card_id && fluzApi.isConfigured()) {
    try {
      await fluzApi.lockVirtualCard(card.fluz_card_id);
    } catch (err: any) {
      logger.error('Provider card lock failed', { error: err?.message });
    }
  }

  await query(`UPDATE card_controls SET frozen = TRUE WHERE card_id = $1`, [id]);
  await query(`UPDATE virtual_cards SET status = 'frozen', updated_at = NOW() WHERE id = $1`, [id]);

  await createAuditLog({
    userId: req.user!.id,
    action: 'CARD_FROZEN',
    entityType: 'virtual_card',
    entityId: id,
  });

  res.json({ success: true, message: 'Card frozen' });
}));

router.post('/:id/unfreeze', validateUUID, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new AppError('Invalid ID format', 400, 'VALIDATION_ERROR');
  }

  const id = req.params.id as string;

  const card = await queryOne<any>(`
    SELECT id, fluz_card_id FROM virtual_cards WHERE id = $1 AND user_id = $2
  `, [id, req.user!.id]);

  if (!card) {
    throw new AppError('Card not found', 404, 'NOT_FOUND');
  }

  if (card.fluz_card_id && fluzApi.isConfigured()) {
    try {
      await fluzApi.unlockVirtualCard(card.fluz_card_id);
    } catch (err: any) {
      logger.error('Provider card unlock failed', { error: err?.message });
    }
  }

  await query(`UPDATE card_controls SET frozen = FALSE WHERE card_id = $1`, [id]);
  await query(`UPDATE virtual_cards SET status = 'active', updated_at = NOW() WHERE id = $1`, [id]);

  await createAuditLog({
    userId: req.user!.id,
    action: 'CARD_UNFROZEN',
    entityType: 'virtual_card',
    entityId: id,
  });

  res.json({ success: true, message: 'Card unfrozen' });
}));

router.post('/:id/spending-limit',
  validateUUID,
  body('limit').isFloat({ min: 0 }),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppError(errors.array()[0].msg, 400, 'VALIDATION_ERROR');
    }

    const id = req.params.id as string;
    const { limit } = req.body;
    const limitCents = Math.round(limit * 100);

    const card = await queryOne(`
      SELECT id FROM virtual_cards WHERE id = $1 AND user_id = $2
    `, [id, req.user!.id]);

    if (!card) {
      throw new AppError('Card not found', 404, 'NOT_FOUND');
    }

    await query(`
      UPDATE virtual_cards SET spending_limit_cents = $1, updated_at = NOW() WHERE id = $2
    `, [limitCents, id]);

    await createAuditLog({
      userId: req.user!.id,
      action: 'CARD_LIMIT_UPDATED',
      entityType: 'virtual_card',
      entityId: id,
      newValues: { spendingLimitCents: limitCents },
    });

    res.json({ success: true, message: 'Spending limit updated' });
  })
);

router.post('/:id/block-merchant',
  validateUUID,
  body('merchant').trim().notEmpty().isLength({ max: 255 }),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppError(errors.array()[0].msg, 400, 'VALIDATION_ERROR');
    }

    const id = req.params.id as string;
    const { merchant } = req.body;

    const card = await queryOne(`
      SELECT vc.id, cc.merchant_blocklist
      FROM virtual_cards vc
      LEFT JOIN card_controls cc ON cc.card_id = vc.id
      WHERE vc.id = $1 AND vc.user_id = $2
    `, [id, req.user!.id]);

    if (!card) {
      throw new AppError('Card not found', 404, 'NOT_FOUND');
    }

    const blocklist = JSON.parse(card.merchant_blocklist || '[]');
    if (!blocklist.includes(merchant)) {
      blocklist.push(merchant);
    }

    await query(`
      UPDATE card_controls SET merchant_blocklist = $1 WHERE card_id = $2
    `, [JSON.stringify(blocklist), id]);

    await createAuditLog({
      userId: req.user!.id,
      action: 'MERCHANT_BLOCKED',
      entityType: 'virtual_card',
      entityId: id,
      newValues: { merchant },
    });

    res.json({ success: true, message: 'Merchant blocked', blocklist });
  })
);

router.post('/:id/unblock-merchant',
  validateUUID,
  body('merchant').trim().notEmpty().isLength({ max: 255 }),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppError(errors.array()[0].msg, 400, 'VALIDATION_ERROR');
    }

    const id = req.params.id as string;
    const { merchant } = req.body;

    const card = await queryOne(`
      SELECT vc.id, cc.merchant_blocklist
      FROM virtual_cards vc
      LEFT JOIN card_controls cc ON cc.card_id = vc.id
      WHERE vc.id = $1 AND vc.user_id = $2
    `, [id, req.user!.id]);

    if (!card) {
      throw new AppError('Card not found', 404, 'NOT_FOUND');
    }

    let blocklist = JSON.parse(card.merchant_blocklist || '[]');
    blocklist = blocklist.filter((m: string) => m !== merchant);

    await query(`
      UPDATE card_controls SET merchant_blocklist = $1 WHERE card_id = $2
    `, [JSON.stringify(blocklist), id]);

    res.json({ success: true, message: 'Merchant unblocked', blocklist });
  })
);

router.post('/:id/category-limit',
  validateUUID,
  body('category').isIn(['shopping', 'food', 'transport', 'entertainment', 'utilities', 'travel', 'other']),
  body('limit').isFloat({ min: 0 }),
  body('period').isIn(['daily', 'weekly', 'monthly']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppError(errors.array()[0].msg, 400, 'VALIDATION_ERROR');
    }

    const id = req.params.id as string;
    const { category, limit, period } = req.body;
    const limitCents = Math.round(limit * 100);

    const card = await queryOne(`
      SELECT vc.id, cc.category_limits
      FROM virtual_cards vc
      LEFT JOIN card_controls cc ON cc.card_id = vc.id
      WHERE vc.id = $1 AND vc.user_id = $2
    `, [id, req.user!.id]);

    if (!card) {
      throw new AppError('Card not found', 404, 'NOT_FOUND');
    }

    const limits = JSON.parse(card.category_limits || '{}');
    limits[category] = { limitCents, period, spentCents: 0 };

    await query(`
      UPDATE card_controls SET category_limits = $1 WHERE card_id = $2
    `, [JSON.stringify(limits), id]);

    await createAuditLog({
      userId: req.user!.id,
      action: 'CATEGORY_LIMIT_SET',
      entityType: 'virtual_card',
      entityId: id,
      newValues: { category, limitCents, period },
    });

    res.json({ success: true, message: 'Category limit set', categoryLimits: limits });
  })
);

router.get('/:id/transactions', validateUUID, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new AppError('Invalid ID format', 400, 'VALIDATION_ERROR');
  }

  const id = req.params.id as string;

  const card = await queryOne(`
    SELECT id FROM virtual_cards WHERE id = $1 AND user_id = $2
  `, [id, req.user!.id]);

  if (!card) {
    throw new AppError('Card not found', 404, 'NOT_FOUND');
  }

  const transactions = await query(`
    SELECT id, amount_cents, currency, merchant, category, status, created_at
    FROM card_transactions
    WHERE card_id = $1
    ORDER BY created_at DESC
    LIMIT 100
  `, [id]);

  res.json({ success: true, data: { transactions } });
}));

router.post('/:id/top-up',
  validateUUID,
  sensitiveOpLimiter,
  body('amount').isFloat({ min: 1, max: 50000 }).withMessage('Top-up amount must be between $1 and $50,000'),
  body('currency').isIn(['USD', 'EUR', 'GBP', 'NGN']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppError(errors.array()[0].msg, 400, 'VALIDATION_ERROR');
    }

    const id = req.params.id as string;
    const { amount, currency } = req.body;
    const amountCents = Math.round(amount * 100);

    const card = await queryOne<any>(`
      SELECT id, currency FROM virtual_cards WHERE id = $1 AND user_id = $2
    `, [id, req.user!.id]);

    if (!card) {
      throw new AppError('Card not found', 404, 'NOT_FOUND');
    }

    const wallet = await queryOne<any>(`
      SELECT balance_cents FROM wallets WHERE user_id = $1 AND currency = $2
    `, [req.user!.id, currency]);

    if (!wallet || Number(wallet.balance_cents) < amountCents) {
      throw new AppError('Insufficient wallet balance', 400, 'INSUFFICIENT_BALANCE');
    }

    await transaction(async (client) => {
      await client.query(`
        UPDATE wallets SET balance_cents = balance_cents - $1 WHERE user_id = $2 AND currency = $3
      `, [amountCents, req.user!.id, currency]);

      await client.query(`
        UPDATE virtual_cards SET balance_cents = balance_cents + $1, updated_at = NOW() WHERE id = $2
      `, [amountCents, id]);

      await client.query(`
        INSERT INTO transactions (user_id, type, status, amount_cents, currency, description)
        VALUES ($1, 'transfer_out', 'SUCCESS', $2, $3, 'Card top-up')
      `, [req.user!.id, amountCents, currency]);
    });

    await createAuditLog({
      userId: req.user!.id,
      action: 'CARD_TOP_UP',
      entityType: 'virtual_card',
      entityId: id,
      newValues: { amountCents, currency },
    });

    res.json({ success: true, message: 'Card topped up successfully' });
  })
);

router.delete('/:id', validateUUID, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new AppError('Invalid ID format', 400, 'VALIDATION_ERROR');
  }

  const id = req.params.id as string;

  const card = await queryOne(`
    SELECT id FROM virtual_cards WHERE id = $1 AND user_id = $2
  `, [id, req.user!.id]);

  if (!card) {
    throw new AppError('Card not found', 404, 'NOT_FOUND');
  }

  await query(`UPDATE virtual_cards SET status = 'cancelled', updated_at = NOW() WHERE id = $1`, [id]);

  await createAuditLog({
    userId: req.user!.id,
    action: 'CARD_CANCELLED',
    entityType: 'virtual_card',
    entityId: id,
  });

  res.json({ success: true, message: 'Card cancelled' });
}));

export { router as cardsRouter };
