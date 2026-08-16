import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { query, queryOne, transaction } from '../db/pool';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { sensitiveOpLimiter } from '../middleware/rateLimit';
import { createAuditLog } from '../services/auditService';
import { logger } from '../middleware/logger';
import { fetchAllGiftCardsWithPricing, calculateTransactionProfit, calculatePricing } from '../services/giftCardPricingService';

const router = Router();
router.use(authenticate);

/** 
 * List available gift card products with pricing and profit margins.
 */
router.get('/products', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    try {
        const products = await fetchAllGiftCardsWithPricing();

        res.json({
            success: true,
            data: {
                items: products,
                total: products.length
            }
        });
    } catch (error: any) {
        logger.error('Failed to fetch gift card products', { error: error?.message });
        throw new AppError('Failed to load gift card products', 500);
    }
}));

/**
 * Handle Gift Card Purchases and Sales.
 * Automates balance deduction and record keeping.
 */
router.post('/requests',
    sensitiveOpLimiter,
    body('type').isIn(['buy', 'sell']),
    body('brand').trim().notEmpty().isLength({ max: 100 }).withMessage('Brand name too long'),
    body('amount').isFloat({ min: 1, max: 10000 }).withMessage('Amount must be between $1 and $10,000'),
    body('currency').optional().isIn(['USD', 'EUR', 'GBP']),
    body('rate').optional().isFloat({ min: 1, max: 200 }).withMessage('Rate must be between 1 and 200'),
    body('paymentMethod').optional().isIn(['fiat', 'usdt']).withMessage('Payment method must be fiat or usdt'),
    body('metadata').optional().isObject(),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            throw new AppError(errors.array()[0].msg, 400, 'VALIDATION_ERROR');
        }

        // SECURITY: pricing is server-authoritative. Any client-supplied `rate`
        // is IGNORED; the applicable rate is derived from server pricing so a
        // caller cannot set their own price (e.g. rate=1 to pay ~1% of face
        // value). Buy uses our sell rate; sell uses our buy rate.
        const { type, brand, amount, currency = 'USD', paymentMethod = 'fiat', metadata } = req.body;
        const amountCents = Math.round(amount * 100);
        const pricing = calculatePricing(brand, amountCents);
        const resolvedRate = type === 'buy' ? pricing.ourSellRate : pricing.ourBuyRate;

        if (type === 'buy') {
            const requestId = await transaction(async (client) => {
                const totalCostCents = Math.round(amountCents * (resolvedRate / 100));

                // Check AVAILABLE balance based on payment method. Fiat
                // availability excludes funds reserved by a pending withdrawal
                // (available = balance_cents - reserved_cents).
                if (paymentMethod === 'usdt') {
                    const walletRows = await client.query(
                        'SELECT usdt_balance_cents FROM wallets WHERE user_id = $1 AND currency = $2 FOR UPDATE',
                        [req.user!.id, 'USD']
                    );
                    const usdtBalance = walletRows.rows[0]?.usdt_balance_cents || 0;
                    if (usdtBalance < totalCostCents) {
                        throw new AppError('Insufficient USDT balance. Add funds via Card Checkout first.', 400, 'INSUFFICIENT_USDT_BALANCE');
                    }
                } else {
                    const walletRows = await client.query(
                        'SELECT balance_cents - COALESCE(reserved_cents, 0) AS available_cents FROM wallets WHERE user_id = $1 AND currency = $2 FOR UPDATE',
                        [req.user!.id, currency]
                    );
                    const fiatAvailable = walletRows.rows[0]?.available_cents || 0;
                    if (fiatAvailable < totalCostCents) {
                        throw new AppError('Insufficient balance to purchase this card.', 400, 'INSUFFICIENT_BALANCE');
                    }
                }

                // Calculate profit (server-authoritative rate)
                const profitCalc = calculateTransactionProfit('buy', brand, amountCents, resolvedRate);

                // 2. Insert Request with profit data
                const requestInsert = await client.query(`
                    INSERT INTO gift_card_requests (
                        user_id, type, brand, amount_cents, currency, rate, 
                        status, cost_cents, profit_cents, our_rate, market_rate, metadata
                    )
                    VALUES ($1, $2, $3, $4, $5, $6, 'processing', $7, $8, $9, $10, $11)
                    RETURNING id
                `, [
                    req.user!.id, type, brand, amountCents, currency, resolvedRate,
                    profitCalc.costCents, profitCalc.profitCents, resolvedRate,
                    profitCalc.profitPercent, metadata ? JSON.stringify(metadata) : null
                ]);

                const rId = requestInsert.rows[0].id;

                // 3. Deduct Balance (USDT or Fiat) with an ATOMIC GUARDED debit.
                //    The WHERE clause re-asserts sufficiency at write time and the
                //    rowCount check aborts the whole transaction if it fails, so a
                //    concurrent debit (or reserved funds) can never be overdrawn.
                if (paymentMethod === 'usdt') {
                    const debit = await client.query(`
                        UPDATE wallets SET usdt_balance_cents = usdt_balance_cents - $1, updated_at = NOW()
                        WHERE user_id = $2 AND currency = 'USD' AND usdt_balance_cents >= $1
                    `, [totalCostCents, req.user!.id]);
                    if (debit.rowCount === 0) {
                        throw new AppError('Insufficient USDT balance. Add funds via Card Checkout first.', 400, 'INSUFFICIENT_USDT_BALANCE');
                    }

                    // Record crypto ledger entry
                    await client.query(`
                        INSERT INTO crypto_ledger_entries (
                            user_id, source_transaction_id, crypto_type, amount_cents,
                            exchange_rate, usd_equivalent_cents, description
                        )
                        VALUES ($1, $2, 'USDT', $3, 1.0, $4, $5)
                    `, [req.user!.id, rId, -totalCostCents, -totalCostCents, `USDT payment for ${brand} gift card`]);
                } else {
                    const debit = await client.query(`
                        UPDATE wallets SET balance_cents = balance_cents - $1, updated_at = NOW()
                        WHERE user_id = $2 AND currency = $3 AND balance_cents - COALESCE(reserved_cents, 0) >= $1
                    `, [totalCostCents, req.user!.id, currency]);
                    if (debit.rowCount === 0) {
                        throw new AppError('Insufficient balance to purchase this card.', 400, 'INSUFFICIENT_BALANCE');
                    }
                }

                // 4. Create internal Transaction record
                await client.query(`
                    INSERT INTO transactions (user_id, type, status, amount_cents, currency, description, reference)
                    VALUES ($1, 'payment', 'SUCCESS', $2, $3, $4, $5)
                `, [
                    req.user!.id, totalCostCents, currency,
                    `Card Purchase: ${brand}${paymentMethod === 'usdt' ? ' (USDT)' : ''}`,
                    rId
                ]);

                return rId;
            });

            res.status(201).json({
                success: true,
                data: {
                    requestId,
                    message: 'Purchase successful. Your card details will be delivered shortly.',
                },
            });

            await createAuditLog({
                userId: req.user!.id,
                action: 'CARD_PURCHASE_AUTO',
                entityType: 'gift_card_request',
                entityId: requestId,
                newValues: { brand, amountCents },
            });

            return;
        }

        // Handle Sell Requests (server-authoritative rate)
        const profitCalc = calculateTransactionProfit('sell', brand, amountCents, resolvedRate);

        const result = await queryOne<{ id: string }>(`
            INSERT INTO gift_card_requests (
                user_id, type, brand, amount_cents, currency, rate, 
                status, cost_cents, profit_cents, our_rate, market_rate, metadata
            )
            VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7, $8, $9, $10, $11)
            RETURNING id
        `, [
            req.user!.id, type, brand, amountCents, currency, resolvedRate,
            profitCalc.costCents, profitCalc.profitCents, resolvedRate,
            profitCalc.profitPercent, metadata ? JSON.stringify(metadata) : null
        ]);

        if (!result) {
            throw new AppError('Failed to submit request.', 500);
        }

        await createAuditLog({
            userId: req.user!.id,
            action: 'GIFT_CARD_SELL_REQUEST',
            entityType: 'gift_card_request',
            entityId: result.id,
            newValues: { brand, amountCents, currency, type },
        });

        res.status(201).json({
            success: true,
            data: {
                requestId: result.id,
                message: 'Sell request submitted successfully.',
            },
        });
    })
);

/**
 * Get user's request history.
 */
router.get('/requests', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const requests = await query(`
        SELECT * FROM gift_card_requests
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT 50
    `, [req.user!.id]);

    res.json({
        success: true,
        data: {
            requests: requests.map(r => ({
                ...r,
                amount: Number(r.amount_cents) / 100,
            })),
        },
    });
}));

export { router as giftCardsRouter };
