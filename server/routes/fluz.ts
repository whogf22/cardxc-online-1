import { Router, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { authenticate, requireSuperAdmin, AuthenticatedRequest } from '../middleware/auth';
import { sensitiveOpLimiter } from '../middleware/rateLimit';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { createAuditLog } from '../services/auditService';
import { logger } from '../middleware/logger';
import * as fluzApi from '../services/fluzApi';
import { v4 as uuidv4 } from 'uuid';

const router = Router();
router.use(authenticate);

router.get('/status', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const configured = fluzApi.isConfigured();
  if (!configured) {
    return res.json({ success: true, data: { configured: false, connected: false } });
  }

  const connection = await fluzApi.testConnection();
  res.json({
    success: true,
    data: {
      configured: true,
      connected: connection.success,
      error: connection.error,
    }
  });
}));

router.get('/wallet', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!fluzApi.isConfigured()) {
    throw new AppError('Card service not configured', 503, 'PROVIDER_NOT_CONFIGURED');
  }

  const wallet = await fluzApi.getWallet();
  res.json({ success: true, data: { wallet } });
}));

router.get('/balance', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!fluzApi.isConfigured()) {
    throw new AppError('Card service not configured', 503, 'PROVIDER_NOT_CONFIGURED');
  }

  const wallet = await fluzApi.getWallet();
  res.json({
    success: true,
    data: {
      balances: wallet.balances,
    }
  });
}));

router.get('/virtual-cards', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!fluzApi.isConfigured()) {
    throw new AppError('Card service not configured', 503, 'PROVIDER_NOT_CONFIGURED');
  }

  const cards = await fluzApi.listVirtualCards();
  res.json({
    success: true,
    data: {
      cards: cards.map(card => ({
        id: card.virtualCardId,
        cardholderName: card.cardholderName,
        last4: card.virtualCardLast4,
        expiryMonth: card.expiryMonth,
        expiryYear: card.expiryYear,
        status: card.status,
        cardType: card.cardType,
        initialAmount: card.initialAmount,
        usedAmount: card.usedAmount,
        remainingAmount: card.initialAmount - card.usedAmount,
        createdAt: card.createdAt,
      }))
    }
  });
}));

router.post('/virtual-cards',
  sensitiveOpLimiter,
  body('spendLimit').isFloat({ min: 1 }).withMessage('Spend limit must be at least $1'),
  body('spendLimitDuration').isIn(['DAILY', 'WEEKLY', 'MONTHLY', 'ANNUAL', 'LIFETIME']).withMessage('Invalid spend limit duration'),
  body('cardNickname').optional().trim().isLength({ max: 100 }),
  body('lockCardNextUse').optional().isBoolean(),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppError(errors.array()[0].msg, 400, 'VALIDATION_ERROR');
    }

    if (!fluzApi.isConfigured()) {
      throw new AppError('Card service not configured', 503, 'PROVIDER_NOT_CONFIGURED');
    }

    const { spendLimit, spendLimitDuration, cardNickname, lockCardNextUse } = req.body;

    const card = await fluzApi.createVirtualCard({
      spendLimit,
      spendLimitDuration,
      cardNickname: cardNickname || undefined,
      primaryFundingSource: 'FLUZ_BALANCE',
      lockCardNextUse: lockCardNextUse || false,
      idempotencyKey: uuidv4(),
    });

    await createAuditLog({
      userId: req.user!.id,
      action: 'VIRTUAL_CARD_CREATED',
      entityType: 'virtual_card',
      entityId: card.virtualCardId,
      newValues: { spendLimit, spendLimitDuration, cardNickname, last4: card.virtualCardLast4 },
    });

    logger.info('Virtual card created via provider', {
      userId: req.user!.id,
      virtualCardId: card.virtualCardId,
      last4: card.virtualCardLast4,
    });

    res.status(201).json({
      success: true,
      data: {
        card: {
          id: card.virtualCardId,
          cardholderName: card.cardholderName,
          last4: card.virtualCardLast4,
          expiryMonth: card.expiryMonth,
          expiryYear: card.expiryYear,
          status: card.status,
          cardType: card.cardType,
          initialAmount: card.initialAmount,
          usedAmount: card.usedAmount,
          createdAt: card.createdAt,
        }
      }
    });
  })
);

router.get('/virtual-cards/:id',
  param('id').isUUID().withMessage('Invalid card ID'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppError('Invalid card ID format', 400, 'VALIDATION_ERROR');
    }

    if (!fluzApi.isConfigured()) {
      throw new AppError('Card service not configured', 503, 'PROVIDER_NOT_CONFIGURED');
    }

    const cardId = req.params.id as string;
    const card = await fluzApi.getVirtualCardDetails(cardId);
    res.json({
      success: true,
      data: {
        card: {
          id: card.virtualCardId,
          cardholderName: card.cardholderName,
          last4: card.virtualCardLast4,
          expiryMonth: card.expiryMonth,
          expiryYear: card.expiryYear,
          status: card.status,
          cardType: card.cardType,
          initialAmount: card.initialAmount,
          usedAmount: card.usedAmount,
          remainingAmount: card.initialAmount - card.usedAmount,
          createdAt: card.createdAt,
        }
      }
    });
  })
);

router.get('/virtual-cards/:id/reveal',
  param('id').isUUID().withMessage('Invalid card ID'),
  sensitiveOpLimiter,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppError('Invalid card ID format', 400, 'VALIDATION_ERROR');
    }

    if (!fluzApi.isConfigured()) {
      throw new AppError('Card service not configured', 503, 'PROVIDER_NOT_CONFIGURED');
    }

    const cardId = req.params.id as string;
    const revealed = await fluzApi.revealVirtualCard(cardId);

    await createAuditLog({
      userId: req.user!.id,
      action: 'VIRTUAL_CARD_REVEALED',
      entityType: 'virtual_card',
      entityId: cardId,
    });

    res.json({
      success: true,
      data: {
        cardNumber: revealed.cardNumber,
        expiryMMYY: revealed.expiryMMYY,
        cvv: revealed.cvv,
        cardHolderName: revealed.cardHolderName,
        billingAddress: revealed.billingAddress,
      }
    });
  })
);

router.post('/virtual-cards/:id/lock',
  param('id').isUUID().withMessage('Invalid card ID'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppError('Invalid card ID format', 400, 'VALIDATION_ERROR');
    }

    if (!fluzApi.isConfigured()) {
      throw new AppError('Card service not configured', 503, 'PROVIDER_NOT_CONFIGURED');
    }

    const cardId = req.params.id as string;
    const result = await fluzApi.lockVirtualCard(cardId);

    await createAuditLog({
      userId: req.user!.id,
      action: 'VIRTUAL_CARD_LOCKED',
      entityType: 'virtual_card',
      entityId: cardId,
    });

    res.json({ success: true, data: { locked: result.locked } });
  })
);

router.post('/virtual-cards/:id/unlock',
  param('id').isUUID().withMessage('Invalid card ID'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppError('Invalid card ID format', 400, 'VALIDATION_ERROR');
    }

    if (!fluzApi.isConfigured()) {
      throw new AppError('Card service not configured', 503, 'PROVIDER_NOT_CONFIGURED');
    }

    const cardId = req.params.id as string;
    const result = await fluzApi.unlockVirtualCard(cardId);

    await createAuditLog({
      userId: req.user!.id,
      action: 'VIRTUAL_CARD_UNLOCKED',
      entityType: 'virtual_card',
      entityId: cardId,
    });

    res.json({ success: true, data: { locked: result.locked } });
  })
);

router.put('/virtual-cards/:id',
  param('id').isUUID().withMessage('Invalid card ID'),
  body('spendLimit').optional().isFloat({ min: 0 }),
  body('spendLimitDuration').optional().isIn(['DAILY', 'WEEKLY', 'MONTHLY', 'ANNUAL', 'LIFETIME']),
  body('cardNickname').optional().trim().isLength({ max: 100 }),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppError(errors.array()[0].msg, 400, 'VALIDATION_ERROR');
    }

    if (!fluzApi.isConfigured()) {
      throw new AppError('Card service not configured', 503, 'PROVIDER_NOT_CONFIGURED');
    }

    const { spendLimit, spendLimitDuration, cardNickname } = req.body;
    const updates: any = {};
    if (spendLimit !== undefined) updates.spendLimit = spendLimit;
    if (spendLimitDuration) updates.spendLimitDuration = spendLimitDuration;
    if (cardNickname) updates.cardNickname = cardNickname;

    const cardId = req.params.id as string;
    const result = await fluzApi.editVirtualCard(cardId, updates);

    await createAuditLog({
      userId: req.user!.id,
      action: 'VIRTUAL_CARD_EDITED',
      entityType: 'virtual_card',
      entityId: cardId,
      newValues: updates,
    });

    res.json({ success: true, data: { card: result } });
  })
);

router.post('/deposit',
  sensitiveOpLimiter,
  body('amount').isFloat({ min: 1 }).withMessage('Deposit amount must be at least $1'),
  body('bankCardId').notEmpty().withMessage('Bank card ID is required'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppError(errors.array()[0].msg, 400, 'VALIDATION_ERROR');
    }

    if (!fluzApi.isConfigured()) {
      throw new AppError('Card service not configured', 503, 'PROVIDER_NOT_CONFIGURED');
    }

    const { amount, bankCardId } = req.body;
    const result = await fluzApi.depositCashBalance(amount, bankCardId, uuidv4());

    await createAuditLog({
      userId: req.user!.id,
      action: 'WALLET_DEPOSIT',
      entityType: 'deposit',
      entityId: result.cashBalanceDeposits?.[0]?.depositId || 'unknown',
      newValues: { amount, bankCardId: bankCardId.slice(-4) },
    });

    res.json({
      success: true,
      data: {
        deposits: result.cashBalanceDeposits,
        balances: result.balances,
      }
    });
  })
);

router.get('/offers', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!fluzApi.isConfigured()) {
    throw new AppError('Card service not configured', 503, 'PROVIDER_NOT_CONFIGURED');
  }

  const offers = await fluzApi.listOffers();
  res.json({ success: true, data: { offers } });
}));

router.get('/merchants', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!fluzApi.isConfigured()) {
    throw new AppError('Card service not configured', 503, 'PROVIDER_NOT_CONFIGURED');
  }

  const offers = await fluzApi.listOffers();
  res.json({ success: true, data: { merchants: offers } });
}));

router.post('/gift-cards/purchase',
  sensitiveOpLimiter,
  body('offerId').notEmpty().isUUID().withMessage('Invalid offer ID'),
  body('amount').isFloat({ min: 1 }).withMessage('Amount must be at least $1'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppError(errors.array()[0].msg, 400, 'VALIDATION_ERROR');
    }

    if (!fluzApi.isConfigured()) {
      throw new AppError('Card service not configured', 503, 'PROVIDER_NOT_CONFIGURED');
    }

    const { offerId, amount } = req.body;
    const purchase = await fluzApi.purchaseGiftCard(offerId, amount, uuidv4());

    await createAuditLog({
      userId: req.user!.id,
      action: 'GIFT_CARD_PURCHASED',
      entityType: 'gift_card',
      entityId: purchase.giftCard.giftCardId,
      newValues: { offerId, amount, offerName: purchase.giftCard.offer.name },
    });

    res.json({ success: true, data: { purchase } });
  })
);

// New: Get transaction history
router.get('/transactions', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!fluzApi.isConfigured()) {
    throw new AppError('Card service not configured', 503, 'PROVIDER_NOT_CONFIGURED');
  }

  const { startDate, endDate, limit, offset } = req.query;
  const transactions = await fluzApi.getTransactions({
    startDate: startDate as string,
    endDate: endDate as string,
    limit: limit ? parseInt(limit as string) : undefined,
    offset: offset ? parseInt(offset as string) : undefined,
  });

  res.json({ success: true, data: { transactions } });
}));

// New: Get virtual card transactions
router.get('/virtual-cards/transactions', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!fluzApi.isConfigured()) {
    throw new AppError('Card service not configured', 503, 'PROVIDER_NOT_CONFIGURED');
  }

  const { cardIds, startDate, endDate } = req.query;
  if (!cardIds) {
    throw new AppError('Card IDs are required', 400, 'VALIDATION_ERROR');
  }

  const cardIdArray = (cardIds as string).split(',');
  const transactions = await fluzApi.getVirtualCardTransactions(cardIdArray, {
    startDate: startDate as string,
    endDate: endDate as string,
  });

  res.json({ success: true, data: { transactions } });
}));

// New: Search merchants with advanced filtering
router.get('/merchants/search', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!fluzApi.isConfigured()) {
    throw new AppError('Card service not configured', 503, 'PROVIDER_NOT_CONFIGURED');
  }

  const { category, search, limit } = req.query;
  const merchants = await fluzApi.getMerchants({
    category: category as string,
    search: search as string,
    limit: limit ? parseInt(limit as string) : undefined,
  });

  res.json({ success: true, data: { merchants } });
}));

// New: Get business categories
router.get('/categories', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!fluzApi.isConfigured()) {
    throw new AppError('Card service not configured', 503, 'PROVIDER_NOT_CONFIGURED');
  }

  const categories = await fluzApi.getBusinessCategories();
  res.json({ success: true, data: { categories } });
}));

// New: Lookup business by name
router.get('/business/lookup', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!fluzApi.isConfigured()) {
    throw new AppError('Card service not configured', 503, 'PROVIDER_NOT_CONFIGURED');
  }

  const { name } = req.query;
  if (!name) {
    throw new AppError('Company name is required', 400, 'VALIDATION_ERROR');
  }

  const businesses = await fluzApi.lookupBusiness(name as string);
  res.json({ success: true, data: { businesses } });
}));

// New: Get price quote for merchant offer
router.post('/offers/quote',
  body('merchantId').notEmpty().withMessage('Merchant ID is required'),
  body('amount').isFloat({ min: 1 }).withMessage('Amount must be at least $1'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppError(errors.array()[0].msg, 400, 'VALIDATION_ERROR');
    }

    if (!fluzApi.isConfigured()) {
      throw new AppError('Card service not configured', 503, 'PROVIDER_NOT_CONFIGURED');
    }

    const { merchantId, amount } = req.body;
    const quote = await fluzApi.getOfferQuote(merchantId, amount);

    res.json({ success: true, data: { quote } });
  })
);

// New: Get user addresses
router.get('/addresses', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!fluzApi.isConfigured()) {
    throw new AppError('Card service not configured', 503, 'PROVIDER_NOT_CONFIGURED');
  }

  const addresses = await fluzApi.getUserAddresses();
  res.json({ success: true, data: { addresses } });
}));

// New: Save address
router.post('/addresses',
  body('streetAddress').notEmpty().withMessage('Street address is required'),
  body('city').notEmpty().withMessage('City is required'),
  body('state').notEmpty().withMessage('State is required'),
  body('postalCode').notEmpty().withMessage('Postal code is required'),
  body('country').notEmpty().withMessage('Country is required'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppError(errors.array()[0].msg, 400, 'VALIDATION_ERROR');
    }

    if (!fluzApi.isConfigured()) {
      throw new AppError('Card service not configured', 503, 'PROVIDER_NOT_CONFIGURED');
    }

    const { streetAddress, city, state, postalCode, country, isDefault } = req.body;
    const address = await fluzApi.saveAddress({
      streetAddress,
      city,
      state,
      postalCode,
      country,
      isDefault: isDefault || false,
    });

    await createAuditLog({
      userId: req.user!.id,
      action: 'ADDRESS_SAVED',
      entityType: 'address',
      entityId: address.addressId,
      newValues: { streetAddress, city, state, postalCode, country },
    });

    res.json({ success: true, data: { address } });
  })
);

// New: Get referral information
router.get('/referral/info', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!fluzApi.isConfigured()) {
    throw new AppError('Card service not configured', 503, 'PROVIDER_NOT_CONFIGURED');
  }

  const referralInfo = await fluzApi.getReferralInfo();
  res.json({ success: true, data: { referral: referralInfo } });
}));

// New: Get referral URL for specific merchant
router.get('/referral/url/:merchantId', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!fluzApi.isConfigured()) {
    throw new AppError('Card service not configured', 503, 'PROVIDER_NOT_CONFIGURED');
  }

  const { merchantId } = req.params;
  const referralUrl = await fluzApi.getReferralUrl(merchantId);
  res.json({ success: true, data: { referralUrl } });
}));

// New: Bulk create virtual cards
router.post('/virtual-cards/bulk',
  requireSuperAdmin,
  sensitiveOpLimiter,
  body('cards').isArray({ min: 1, max: 50 }).withMessage('Cards array required (1-50 items)'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppError(errors.array()[0].msg, 400, 'VALIDATION_ERROR');
    }

    if (!fluzApi.isConfigured()) {
      throw new AppError('Card service not configured', 503, 'PROVIDER_NOT_CONFIGURED');
    }

    const { cards } = req.body;
    const createdCards = await fluzApi.bulkCreateVirtualCards(cards, uuidv4());

    await createAuditLog({
      userId: req.user!.id,
      action: 'BULK_VIRTUAL_CARDS_CREATED',
      entityType: 'virtual_card',
      entityId: 'bulk',
      newValues: { count: createdCards.length },
    });

    logger.info('Bulk virtual cards created', {
      userId: req.user!.id,
      count: createdCards.length,
    });

    res.status(201).json({
      success: true,
      data: {
        cards: createdCards.map(card => ({
          id: card.virtualCardId,
          last4: card.virtualCardLast4,
          status: card.status,
        })),
        total: createdCards.length,
      }
    });
  })
);

// New: Get bulk order status
router.get('/virtual-cards/bulk/:orderId', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!fluzApi.isConfigured()) {
    throw new AppError('Card service not configured', 503, 'PROVIDER_NOT_CONFIGURED');
  }

  const { orderId } = req.params;
  const status = await fluzApi.getBulkOrderStatus(orderId);
  res.json({ success: true, data: { status } });
}));

export { router as fluzRouter };
