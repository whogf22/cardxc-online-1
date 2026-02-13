import { Router, Response } from 'express';
import { body, query as queryParam, validationResult } from 'express-validator';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { sensitiveOpLimiter } from '../middleware/rateLimit';
import { getExchangeRate, getSwapQuote, executeSwap, getSwapBalances } from '../services/swapService';

const router = Router();

/**
 * GET /api/swap/rates
 * Get current exchange rates
 */
router.get('/rates',
    authenticate,
    queryParam('from').optional().trim(),
    queryParam('to').optional().trim(),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        const { from, to } = req.query;

        if (from && to) {
            // Get specific rate
            const rate = await getExchangeRate(from as string, to as string);
            return res.json({
                success: true,
                data: {
                    from,
                    to,
                    rate,
                    lastUpdated: new Date().toISOString()
                }
            });
        }

        // Get all common rates
        const currencies = ['USD', 'USDT', 'BTC', 'ETH', 'BNB', 'EUR', 'GBP'];
        const rates: Record<string, any> = {};

        for (const fromCurrency of currencies) {
            rates[fromCurrency] = {};
            for (const toCurrency of currencies) {
                if (fromCurrency !== toCurrency) {
                    rates[fromCurrency][toCurrency] = await getExchangeRate(fromCurrency, toCurrency);
                }
            }
        }

        res.json({
            success: true,
            data: {
                rates,
                lastUpdated: new Date().toISOString()
            }
        });
    })
);

/**
 * GET /api/swap/balances
 * Get user's available balances for swapping
 */
router.get('/balances',
    authenticate,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        const balances = await getSwapBalances(req.user!.id);

        res.json({
            success: true,
            data: { balances }
        });
    })
);

/**
 * POST /api/swap/quote
 * Get swap quote
 */
router.post('/quote',
    authenticate,
    body('fromCurrency').trim().notEmpty().isIn(['USD', 'USDT', 'BTC', 'ETH', 'BNB']),
    body('toCurrency').trim().notEmpty().isIn(['USD', 'USDT', 'BTC', 'ETH', 'BNB']),
    body('amount').isFloat({ min: 0.01 }),
    body('slippage').optional().isFloat({ min: 0, max: 0.1 }),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            throw new AppError(errors.array()[0].msg, 400, 'VALIDATION_ERROR');
        }

        const { fromCurrency, toCurrency, amount, slippage } = req.body;

        if (fromCurrency === toCurrency) {
            throw new AppError('Cannot swap same currency', 400);
        }

        const quote = await getSwapQuote({
            userId: req.user!.id,
            fromCurrency,
            toCurrency,
            amount,
            slippage
        });

        res.json({
            success: true,
            data: { quote }
        });
    })
);

/**
 * POST /api/swap/execute
 * Execute swap transaction
 */
router.post('/execute',
    authenticate,
    sensitiveOpLimiter,
    body('fromCurrency').trim().notEmpty().isIn(['USD', 'USDT']),
    body('toCurrency').trim().notEmpty().isIn(['USD', 'USDT']),
    body('amount').isFloat({ min: 0.01 }),
    body('slippage').optional().isFloat({ min: 0, max: 0.1 }),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            throw new AppError(errors.array()[0].msg, 400, 'VALIDATION_ERROR');
        }

        const { fromCurrency, toCurrency, amount, slippage } = req.body;

        if (fromCurrency === toCurrency) {
            throw new AppError('Cannot swap same currency', 400);
        }

        const result = await executeSwap({
            userId: req.user!.id,
            fromCurrency,
            toCurrency,
            amount,
            slippage
        });

        res.json({
            success: true,
            data: result,
            message: `Successfully swapped ${amount} ${fromCurrency} to ${result.toAmount.toFixed(6)} ${toCurrency}`
        });
    })
);

export { router as swapRouter };
