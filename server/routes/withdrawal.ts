import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { financialOpLimiter } from '../middleware/rateLimit';
import { processWithdrawal } from '../services/withdrawalService';
import {
  getSupportedNetworks,
  isCryptoProviderConfigured,
  getCryptoProviderName,
  getCryptoDepositAddresses,
  parseUsdtAmountToCents,
} from '../services/cryptoProviderService';

const router = Router();

/**
 * Extract a caller-supplied logical idempotency key for a withdrawal. Accepts
 * the standard `Idempotency-Key` header (preferred) or an `idempotencyKey`
 * body field. Bounded to 255 chars to match the persisted column; anything
 * empty/oversized/non-string is treated as absent (the request is then simply
 * non-idempotent rather than rejected).
 */
function extractIdempotencyKey(req: AuthenticatedRequest): string | undefined {
    const raw = req.get('Idempotency-Key') ?? req.body?.idempotencyKey;
    if (typeof raw !== 'string') return undefined;
    const trimmed = raw.trim();
    if (!trimmed || trimmed.length > 255) return undefined;
    return trimmed;
}

/**
 * GET /api/withdraw/crypto/config
 * Returns provider/network status + deposit addresses configured on server
 */
router.get('/crypto/config',
    authenticate,
    asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
        const addresses = getCryptoDepositAddresses();
        res.json({
            success: true,
            data: {
                providerName: getCryptoProviderName(),
                providerConfigured: isCryptoProviderConfigured(),
                supportedNetworks: getSupportedNetworks(),
                addresses,
            },
        });
    })
);

/**
 * POST /api/withdraw/bank
 * Bank transfer withdrawal
 */
router.post('/bank',
    authenticate,
    financialOpLimiter,
    body('amount').isFloat({ min: 1 }),
    body('currency').isIn(['USD', 'EUR', 'GBP']),
    body('walletType').isIn(['fiat', 'usdt']),
    body('bankName').trim().notEmpty().isLength({ max: 255 }),
    body('accountNumber').trim().notEmpty().isLength({ max: 100 }),
    body('accountName').trim().notEmpty().isLength({ max: 255 }),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            throw new AppError(errors.array()[0].msg, 400, 'VALIDATION_ERROR');
        }

        const { amount, currency, walletType, bankName, accountNumber, accountName } = req.body;

        const result = await processWithdrawal({
            type: 'bank',
            userId: req.user!.id,
            amount,
            currency,
            walletType,
            bankName,
            accountNumber,
            accountName,
            // NEW-8: the key was previously accepted by the interface and never
            // passed, so a double submit created two reserves and two rows.
            idempotencyKey: extractIdempotencyKey(req)
        });

        res.status(201).json({
            success: true,
            data: result,
            message: result.message
        });
    })
);

/**
 * POST /api/withdraw/crypto
 * Crypto (USDT) withdrawal to external wallet
 */
router.post('/crypto',
    authenticate,
    financialOpLimiter,
    body('amount').isFloat({ min: 10 }).withMessage('Minimum crypto withdrawal is 10 USDT'),
    // NEW-6: the USDT ledger unit is 2 dp while the chain is 6 dp. Without a
    // decimal-place constraint a sub-cent amount reached both scales and the
    // chain was sent up to ~0.005 USDT more than the wallet was debited. Reject
    // at the boundary rather than truncating.
    body('amount').custom((v) => parseUsdtAmountToCents(v) !== null)
        .withMessage('Amount must have at most 2 decimal places'),
    body('walletAddress').trim().notEmpty().isLength({ min: 20, max: 255 }),
    body('network').isIn(['TRC20', 'ERC20', 'BEP20', 'POLYGON']),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            throw new AppError(errors.array()[0].msg, 400, 'VALIDATION_ERROR');
        }

        const { amount, walletAddress, network } = req.body;

        const result = await processWithdrawal({
            type: 'crypto',
            userId: req.user!.id,
            amount,
            walletAddress,
            network,
            idempotencyKey: extractIdempotencyKey(req)
        });

        res.status(201).json({
            success: true,
            data: result,
            message: result.message
        });
    })
);

/**
 * POST /api/withdraw/platform
 * Transfer to another user on the platform (instant P2P)
 */
router.post('/platform',
    authenticate,
    financialOpLimiter,
    body('amount').isFloat({ min: 1 }),
    body('recipientEmail').isEmail().normalizeEmail(),
    body('walletType').isIn(['fiat', 'usdt']),
    body('message').optional().trim().isLength({ max: 500 }),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            throw new AppError(errors.array()[0].msg, 400, 'VALIDATION_ERROR');
        }

        const { amount, recipientEmail, walletType, message } = req.body;

        const result = await processWithdrawal({
            type: 'platform',
            userId: req.user!.id,
            recipientEmail,
            amount,
            walletType,
            message,
            // NEW-8: previously discarded, so a double submit moved the money twice.
            idempotencyKey: extractIdempotencyKey(req)
        });

        res.status(201).json({
            success: true,
            data: result,
            message: result.message
        });
    })
);

export { router as withdrawalRouter };
